import { runAgent } from "@/lib/agent";
import type { Completion, ProviderSession, ToolReply } from "@/lib/providers/types";
import type { StreamEvent } from "@/lib/types";

/** A model that says exactly what the script says. Records the tool results it is sent back. */
export function scripted(script: (Completion | Error | ((seen: ToolReply[][]) => Completion))[]) {
  const seen: ToolReply[][] = [];
  let i = 0;
  const session: ProviderSession = {
    label: "Fake",
    async complete() {
      const step = script[Math.min(i++, script.length - 1)];
      if (step instanceof Error) throw step;
      return typeof step === "function" ? step(seen) : step;
    },
    addToolResults: (r) => void seen.push(r),
  };
  return { session, seen, rounds: () => i };
}

export const call = (id: string, name: string, input: unknown) => ({ id, name, input });
export const say = (text: string): Completion => ({ text, calls: [] });
export const ask = (...calls: ReturnType<typeof call>[]): Completion => ({ text: "", calls });

export async function run(script: Parameters<typeof scripted>[0], history?: string[]) {
  const s = scripted(script);
  const events: StreamEvent[] = [];
  let error: unknown;
  try {
    await runAgent({ session: s.session, emit: (e) => events.push(e), history });
  } catch (e) {
    error = e;
  }
  const ends = events.flatMap((e) => (e.type === "tool_end" ? [e] : []));
  return {
    ...s, events, error, ends,
    answer: events.find((e) => e.type === "answer") as Extract<StreamEvent, { type: "answer" }> | undefined,
    errorEvent: events.find((e) => e.type === "error") as Extract<StreamEvent, { type: "error" }> | undefined,
    statuses: (name: string) => ends.filter((e) => e.name === name).map((e) => e.result.status),
  };
}

export const route = call("r1", "route_ticket", { category: "billing", urgency: 2, confidence: 0.9 });
