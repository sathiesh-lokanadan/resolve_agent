import { isActionTool, newToolContext, runTool } from "./tools";
import { redact, redactDeep } from "./redact";
import type { ProviderSession, ToolReply } from "./providers/types";
import type { StreamEvent } from "./types";

export const MAX_TOOL_CALLS = 10;
export const MAX_ROUNDS = 8;

interface Options {
  session: ProviderSession;
  emit: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

/** Ask the model, run the tools it requests, send the results back, repeat. Works with any provider. */
export async function runAgent({ session, emit, signal }: Options) {
  const ctx = newToolContext();
  let calls = 0;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (signal?.aborted) return;
    const lastChance = round === MAX_ROUNDS || calls >= MAX_TOOL_CALLS;
    emit({ type: "step", label: round === 1 ? `Asking ${session.label}` : `Asking ${session.label} again` });

    const out = await session.complete(!lastChance);
    if (out.refused) {
      emit({ type: "error", message: out.refused });
      return;
    }
    if (!out.calls.length || lastChance) {
      const limit = out.calls.length ? "\n\n_Stopped: the tool-call or round limit was reached._" : "";
      emit({ type: "answer", text: redact(out.text || "I could not produce an answer.") + limit });
      return;
    }

    const replies: ToolReply[] = [];
    for (const call of out.calls) {
      if (calls >= MAX_TOOL_CALLS) {
        replies.push({ call, isError: true, content: "Tool-call limit reached. Answer with what you have." });
        continue;
      }
      calls++;
      emit({ type: "step", label: `Calling ${call.name}` });
      emit({ type: "tool_start", id: call.id, name: call.name, args: redactDeep(call.input) });
      const t0 = Date.now();
      const result = redactDeep(await runTool(call.name, call.input, ctx));
      emit({ type: "tool_end", id: call.id, name: call.name, ms: Date.now() - t0, result });
      if (result.status === "pending_approval" && isActionTool(call.name))
        emit({ type: "approval", id: call.id, name: call.name, action: result.data });
      replies.push({ call, isError: result.status === "rejected" || result.status === "error", content: JSON.stringify(result) });
    }
    session.addToolResults(replies);
  }
}
