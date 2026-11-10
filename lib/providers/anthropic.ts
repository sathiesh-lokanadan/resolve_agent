import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "../prompt";
import { TOOL_DEFS } from "../tool-defs";
import type { ProviderSession, SessionOptions } from "./types";

/** Models that take the effort setting. Other ids are sent without it. */
const EFFORT_MODELS = new Set(["claude-sonnet-5-5", "claude-haiku-5-5"]);

export function anthropicSession({ apiKey, model, turns, signal }: SessionOptions): ProviderSession {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const messages: Anthropic.MessageParam[] = turns.map((t) => ({ role: t.role, content: t.content }));

  return {
    label: "Claude",
    async complete(allowTools) {
      const res = await client.messages.create(
        {
          model,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          tools: TOOL_DEFS,
          tool_choice: { type: allowTools ? "auto" : "none" },
          ...(EFFORT_MODELS.has(model) ? { output_config: { effort: "medium" as const } } : {}),
          messages,
        },
        { signal },
      );
      if (res.stop_reason === "refusal") return { text: "", calls: [], refused: "Claude declined to answer this request." };
      // Keep the full content blocks (thinking, text, tool_use) exactly as returned.
      messages.push({ role: "assistant", content: res.content as Anthropic.ContentBlockParam[] });
      return {
        text: res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim(),
        calls: res.content.flatMap((b) => (b.type === "tool_use" ? [{ id: b.id, name: b.name, input: b.input }] : [])),
      };
    },
    addToolResults(replies) {
      messages.push({
        role: "user",
        content: replies.map((r) => ({ type: "tool_result", tool_use_id: r.call.id, is_error: r.isError, content: r.content })),
      });
    },
  };
}

export function describeAnthropicError(err: unknown): string | undefined {
  if (err instanceof Anthropic.AuthenticationError) return "Anthropic rejected the API key.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key is not allowed to use that model.";
  if (err instanceof Anthropic.NotFoundError) return "Anthropic does not know that model id.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by Anthropic. Wait a moment and try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the Anthropic API.";
}
