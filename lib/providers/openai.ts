import { SYSTEM_PROMPT } from "../prompt";
import { TOOL_DEFS } from "../tool-defs";
import { postJson } from "./http";
import { ProviderError, type ProviderSession, type SessionOptions } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const BASE = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

const TOOLS = TOOL_DEFS.map((t) => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}));

function parseArgs(raw: unknown): unknown {
  try {
    return JSON.parse(typeof raw === "string" && raw.trim() ? raw : "{}");
  } catch {
    return undefined; // runTool rejects it with a clear message
  }
}

/** OpenAI Chat Completions with function calling. */
export function openaiSession({ apiKey, model, turns, signal }: SessionOptions): ProviderSession {
  const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...turns.map((t) => ({ role: t.role, content: t.content }))];

  return {
    label: "OpenAI",
    async complete(allowTools) {
      const json = await postJson(
        `${BASE}/chat/completions`,
        { authorization: `Bearer ${apiKey}` },
        { model, messages, tools: TOOLS, tool_choice: allowTools ? "auto" : "none", max_completion_tokens: 16000 },
        signal,
      );
      const choice = json.choices?.[0];
      const msg = choice?.message;
      if (!msg) throw new ProviderError("OpenAI returned an empty answer.");
      const calls = (msg.tool_calls ?? [])
        .filter((c: any) => c.type === "function")
        .map((c: any) => ({ id: c.id, name: c.function.name, input: parseArgs(c.function.arguments) }));
      const text = typeof msg.content === "string" ? msg.content.trim() : "";
      if (!text && !calls.length) {
        if (msg.refusal) return { text: "", calls: [], refused: "OpenAI declined to answer this request." };
        if (choice.finish_reason === "length")
          throw new ProviderError("The model used its whole output budget before answering. Try a smaller model.");
      }
      messages.push(msg);
      return { text, calls };
    },
    addToolResults(replies) {
      for (const r of replies) messages.push({ role: "tool", tool_call_id: r.call.id, content: r.content });
    },
  };
}

export function describeOpenAiError(err: ProviderError): string {
  if (err.status === 401) return "OpenAI rejected the API key.";
  if (err.status === 403) return "This API key is not allowed to use that model.";
  if (err.status === 404) return "OpenAI does not know that model id, or the key cannot see it.";
  if (err.status === 429) return "OpenAI rate limit or quota reached. Check the account's billing.";
  return err.message;
}
