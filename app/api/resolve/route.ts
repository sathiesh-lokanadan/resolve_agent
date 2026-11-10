import { runAgent } from "@/lib/agent";
import { createSession, describeError } from "@/lib/providers";
import { MODEL_ID_PATTERN, PROVIDERS, type Provider, type StreamEvent, type Turn } from "@/lib/types";

export const maxDuration = 120;

function parseBody(body: unknown): { provider: Provider; model: string; turns: Turn[] } | string {
  const b = body as { provider?: unknown; model?: unknown; messages?: unknown } | null;
  const provider = (b?.provider ?? "anthropic") as Provider;
  if (!PROVIDERS.includes(provider)) return "Unknown provider.";
  if (typeof b?.model !== "string" || !MODEL_ID_PATTERN.test(b.model)) return "Unknown or invalid model id.";
  const list = b.messages;
  if (!Array.isArray(list) || !list.length || list.length > 40) return "messages must be a list of 1 to 40 turns.";
  const turns: Turn[] = [];
  for (const m of list) {
    const ok = m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= 12000;
    if (!ok) return "Each message needs a role and text (max 12000 characters).";
    turns.push({ role: m.role, content: m.content });
  }
  return turns[turns.length - 1].role === "user" ? { provider, model: b.model, turns } : "The last message must be from the user.";
}

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key")?.trim();
  if (!apiKey) return Response.json({ error: "Add your API key first." }, { status: 401 });

  const parsed = parseBody(await req.json().catch(() => null));
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });

  const { provider, model, turns } = parsed;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          /* client went away */
        }
      };
      try {
        const session = createSession(provider, { apiKey, model, turns, signal: req.signal });
        await runAgent({ session, emit, signal: req.signal });
      } catch (err) {
        if (!req.signal.aborted) emit({ type: "error", message: describeError(err, provider, apiKey) });
      }
      emit({ type: "done" });
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
