import type { ApprovalState, ChatMessage, Provider, StreamEvent, Turn } from "./types";
import { ACTION_TOOLS } from "./types";

/** POST the chat to the backend and call onEvent for each newline-delimited JSON event. */
export async function streamResolve(opts: {
  apiKey: string;
  provider: Provider;
  model: string;
  messages: Turn[];
  signal: AbortSignal;
  onEvent: (event: StreamEvent) => void;
}) {
  const res = await fetch("/api/resolve", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": opts.apiKey },
    body: JSON.stringify({ provider: opts.provider, model: opts.model, messages: opts.messages }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status}).`);
  }
  await consumeStream(res.body, opts.onEvent, opts.signal);
}

export const STREAM_IDLE_MS = 60_000;

/**
 * Read newline-delimited JSON events. Fails loudly (instead of hanging or silently stopping) when
 * the stream stalls, when lines are corrupt, or when it ends without the final `done` event.
 */
export async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
  idleMs = STREAM_IDLE_MS,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;
  let bad = 0;
  const flush = (line: string) => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line) as StreamEvent;
      if (event.type === "done") sawDone = true;
      onEvent(event);
    } catch {
      bad++;
    }
  };
  for (;;) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("The server stopped responding. Try again.")), idleMs);
    });
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await Promise.race([reader.read(), stalled]);
    } catch (err) {
      reader.cancel().catch(() => {});
      if (signal?.aborted) throw err;
      throw err instanceof Error && err.message.startsWith("The server") ? err : new Error("The connection dropped before the answer finished. Try again.");
    } finally {
      clearTimeout(timer);
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      flush(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  flush(buffer);
  if (!sawDone) throw new Error("The connection dropped before the answer finished. Try again.");
  if (bad) throw new Error(`${bad} corrupt event(s) were received. The result may be incomplete; try again.`);
}

type Patch = (m: ChatMessage) => ChatMessage;
export const patchMessage = (list: ChatMessage[], id: string, fn: Patch) =>
  list.map((m) => (m.id === id ? fn(m) : m));

/** Fold one stream event into the assistant message it belongs to. */
export function applyEvent(m: ChatMessage, e: StreamEvent): ChatMessage {
  switch (e.type) {
    case "step":
      return { ...m, steps: [...m.steps, e.label] };
    case "tool_start":
      return { ...m, calls: [...m.calls, { id: e.id, name: e.name, args: e.args }] };
    case "tool_end":
      return { ...m, calls: m.calls.map((c) => (c.id === e.id ? { ...c, ms: e.ms, result: e.result } : c)) };
    case "approval":
      return { ...m, calls: m.calls.map((c) => (c.id === e.id ? { ...c, approval: { state: "pending" } } : c)) };
    case "answer":
      return { ...m, text: e.text };
    case "error":
      return { ...m, status: "error", error: e.message };
    default:
      return m;
  }
}

export const decide = (m: ChatMessage, callId: string, approval: ApprovalState): ChatMessage => ({
  ...m,
  calls: m.calls.map((c) => (c.id === callId ? { ...c, approval } : c)),
});

const describeAction = (c: ChatMessage["calls"][number]) => {
  const a = c.approval?.state ?? "not queued";
  const why = c.approval?.reason ? ` (${c.approval.reason})` : "";
  return `${c.name}: ${c.result?.status}, human decision: ${a}${why}`;
};

/** Earlier turns go back to Claude as plain text, including what the human decided. */
export function toTurns(messages: ChatMessage[]): Turn[] {
  return messages.flatMap((m): Turn[] => {
    if (m.role === "user") return [{ role: "user", content: m.text }];
    if (!m.text) return [];
    const actions = m.calls.filter((c) => ACTION_TOOLS.includes(c.name) && c.result);
    const log = actions.length ? `\n\n[Actions this turn: ${actions.map(describeAction).join("; ")}]` : "";
    return [{ role: "assistant", content: m.text + log }];
  });
}
