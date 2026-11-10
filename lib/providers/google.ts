import { SYSTEM_PROMPT } from "../prompt";
import { TOOL_DEFS } from "../tool-defs";
import { postJson } from "./http";
import { ProviderError, type ProviderSession, type SessionOptions, type ToolCall } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const BASE = (process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");

/** Gemini takes an OpenAPI-style schema: upper-case types and no additionalProperties. */
function toGeminiSchema(s: any): any {
  const out: any = { type: String(s.type).toUpperCase() };
  if (s.description) out.description = s.description;
  if (s.enum) out.enum = s.enum;
  if (s.items) out.items = toGeminiSchema(s.items);
  if (s.properties) out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
  if (s.required?.length) out.required = s.required;
  return out;
}

const TOOLS = [
  { functionDeclarations: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, parameters: toGeminiSchema(t.input_schema) })) },
];

function parseResult(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

/** Google Gemini generateContent with function calling. */
export function googleSession({ apiKey, model, turns, signal }: SessionOptions): ProviderSession {
  const contents: any[] = turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] }));
  const nativeIds = new Set<string>();
  let counter = 0;

  return {
    label: "Gemini",
    async complete(allowTools) {
      const json = await postJson(
        `${BASE}/models/${encodeURIComponent(model)}:generateContent`,
        { "x-goog-api-key": apiKey },
        {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          tools: TOOLS,
          toolConfig: { functionCallingConfig: { mode: allowTools ? "AUTO" : "NONE" } },
          generationConfig: { maxOutputTokens: 16384 },
        },
        signal,
      );
      const cand = json.candidates?.[0];
      if (!cand?.content) {
        const why = json.promptFeedback?.blockReason ?? cand?.finishReason ?? "empty answer";
        return { text: "", calls: [], refused: `Gemini returned no answer (${why}).` };
      }
      const parts: any[] = cand.content.parts ?? [];
      const calls: ToolCall[] = parts
        .filter((p) => p.functionCall)
        .map((p) => {
          const id = p.functionCall.id ?? `gemini_call_${++counter}`;
          if (p.functionCall.id) nativeIds.add(id);
          return { id, name: p.functionCall.name, input: p.functionCall.args ?? {} };
        });
      const text = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
      if (!text && !calls.length && cand.finishReason === "MAX_TOKENS")
        throw new ProviderError("The model used its whole output budget before answering. Try a smaller model.");
      // Keep the model's parts exactly as returned: thinking models need their signatures sent back.
      contents.push({ role: "model", parts });
      return { text, calls };
    },
    addToolResults(replies) {
      contents.push({
        role: "user",
        parts: replies.map((r) => ({
          functionResponse: {
            ...(nativeIds.has(r.call.id) ? { id: r.call.id } : {}),
            name: r.call.name,
            response: { result: parseResult(r.content) },
          },
        })),
      });
    },
  };
}

export function describeGoogleError(err: ProviderError): string {
  if (err.status === 400 && /api key/i.test(err.message)) return "Google rejected the API key.";
  if (err.status === 401 || err.status === 403) return "Google rejected the API key, or it cannot use that model.";
  if (err.status === 404) return "Google does not know that model id.";
  if (err.status === 429) return "Google rate limit or quota reached.";
  return err.message;
}
