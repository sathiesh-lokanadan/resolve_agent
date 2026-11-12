import { isActionTool, newToolContext, runTool } from "./tools";
import { redact, redactDeep } from "./redact";
import { guardAnswer } from "./output-guard";
import { findArticle } from "./data";
import { log } from "./log";
import type { ProviderSession, ToolReply } from "./providers/types";
import type { StreamEvent } from "./types";

export const MAX_TOOL_CALLS = 10;
export const MAX_ROUNDS = 8;

interface Options {
  session: ProviderSession;
  emit: (event: StreamEvent) => void;
  signal?: AbortSignal;
  /** Text of the earlier turns, so citations from them stay valid. */
  history?: string[];
  requestId?: string;
}

/**
 * Ask the model, run the tools it requests, send the results back, repeat. Works with any provider.
 * Provider errors are thrown to the caller after the tools that already ran have been streamed,
 * so the page keeps the partial work.
 */
export async function runAgent({ session, emit, signal, history, requestId }: Options) {
  const ctx = newToolContext(history);
  let calls = 0;
  let round = 0;
  const finish = (outcome: string) =>
    log("agent_end", { requestId, outcome, rounds: round, toolCalls: calls, proposed: [...ctx.proposed].join(",") });

  for (round = 1; round <= MAX_ROUNDS; round++) {
    if (signal?.aborted) return finish("aborted");
    const lastChance = round === MAX_ROUNDS || calls >= MAX_TOOL_CALLS;
    emit({ type: "step", label: round === 1 ? `Asking ${session.label}` : `Asking ${session.label} again` });

    const out = await session.complete(!lastChance);
    if (out.refused) {
      emit({ type: "error", message: out.refused });
      return finish("refused");
    }
    if (!out.calls.length || lastChance) {
      if (!out.text.trim() && !out.calls.length) {
        // Never invent an answer: say that the model gave none, so the agent can retry.
        emit({ type: "error", message: "The model returned an empty answer. Try again." });
        return finish("empty_answer");
      }
      const limit = out.calls.length ? "_Stopped: the tool-call or round limit was reached before the model wrote an answer. Tool results are above._" : "";
      const guarded = guardAnswer([redact(out.text), limit].filter(Boolean).join("\n\n"), ctx, (id) => !!findArticle(id));
      for (const n of guarded.notes) {
        emit({ type: "step", label: "Guardrail: " + n });
        log("guardrail_output", { requestId, note: n.slice(0, 80) }, "warn");
      }
      emit({ type: "answer", text: guarded.text });
      return finish(guarded.notes.length ? "answered_with_notice" : "answered");
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
      log("tool_call", { requestId, tool: call.name, status: result.status, ms: Date.now() - t0 });
      if (result.status === "pending_approval" && isActionTool(call.name))
        emit({ type: "approval", id: call.id, name: call.name, action: result.data });
      replies.push({ call, isError: result.status === "rejected" || result.status === "error", content: JSON.stringify(result) });
    }
    session.addToolResults(replies);
  }
  finish("round_limit");
}
