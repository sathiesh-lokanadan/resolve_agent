import type Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt";
import { TOOL_DEFS } from "./tool-defs";
import { isActionTool, newToolContext, runTool } from "./tools";
import { redact, redactDeep } from "./redact";
import type { StreamEvent, Turn } from "./types";

export const MAX_TOOL_CALLS = 10;
export const MAX_ROUNDS = 8;

interface Options {
  client: Anthropic;
  model: string;
  turns: Turn[];
  emit: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

const textOf = (blocks: Anthropic.ContentBlock[]) =>
  blocks.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();

/** Ask Claude, run the tools it requests, send the results back, repeat. */
export async function runAgent({ client, model, turns, emit, signal }: Options) {
  const messages: Anthropic.MessageParam[] = turns.map((t) => ({ role: t.role, content: t.content }));
  const ctx = newToolContext();
  let calls = 0;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (signal?.aborted) return;
    const lastChance = round === MAX_ROUNDS || calls >= MAX_TOOL_CALLS;
    emit({ type: "step", label: round === 1 ? "Asking Claude" : "Asking Claude again" });

    const res = await client.messages.create(
      {
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFS,
        tool_choice: { type: lastChance ? "none" : "auto" },
        output_config: { effort: "medium" },
        messages,
      },
      { signal },
    );

    if (res.stop_reason === "refusal") {
      emit({ type: "error", message: "Claude declined to answer this request." });
      return;
    }
    // Keep the full content blocks (thinking, text, tool_use) exactly as returned.
    messages.push({ role: "assistant", content: res.content as Anthropic.ContentBlockParam[] });

    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const text = textOf(res.content);
    if (!uses.length || lastChance) {
      const limit = uses.length ? "\n\n_Stopped: the tool-call or round limit was reached._" : "";
      emit({ type: "answer", text: redact(text || "I could not produce an answer.") + limit });
      return;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of uses) {
      if (calls >= MAX_TOOL_CALLS) {
        results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: "Tool-call limit reached. Answer with what you have." });
        continue;
      }
      calls++;
      emit({ type: "step", label: `Calling ${use.name}` });
      emit({ type: "tool_start", id: use.id, name: use.name, args: redactDeep(use.input) });
      const t0 = Date.now();
      const result = redactDeep(await runTool(use.name, use.input, ctx));
      emit({ type: "tool_end", id: use.id, name: use.name, ms: Date.now() - t0, result });
      if (result.status === "pending_approval" && isActionTool(use.name))
        emit({ type: "approval", id: use.id, name: use.name, action: result.data });
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        is_error: result.status === "rejected" || result.status === "error",
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: results });
  }
}
