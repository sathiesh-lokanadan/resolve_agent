import { MODEL_ID_PATTERN, PROVIDERS, type Provider, type Turn } from "./types";

/** Input guardrails for POST /api/resolve: shape, size and character checks on the request body. */
export const MAX_TURNS = 40;
export const MAX_TURN_CHARS = 12_000;
/** Whole conversation, in characters. Stops a client from sending 40 maximum-size turns. */
export const MAX_TOTAL_CHARS = 60_000;
export const MAX_BODY_BYTES = 200_000;

// Control characters (except tab, newline, carriage return) have no place in a ticket.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function parseBody(body: unknown): { provider: Provider; model: string; turns: Turn[] } | string {
  const b = body as { provider?: unknown; model?: unknown; messages?: unknown } | null;
  const provider = (b?.provider ?? "anthropic") as Provider;
  if (!PROVIDERS.includes(provider)) return "Unknown provider.";
  if (typeof b?.model !== "string" || !MODEL_ID_PATTERN.test(b.model)) return "Unknown or invalid model id.";
  const list = b.messages;
  if (!Array.isArray(list) || !list.length || list.length > MAX_TURNS) return `messages must be a list of 1 to ${MAX_TURNS} turns.`;
  const turns: Turn[] = [];
  let total = 0;
  for (const m of list) {
    const ok = m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= MAX_TURN_CHARS;
    if (!ok) return `Each message needs a role and text (max ${MAX_TURN_CHARS} characters).`;
    const content = m.content.replace(CONTROL_CHARS, "");
    total += content.length;
    turns.push({ role: m.role, content });
  }
  if (total > MAX_TOTAL_CHARS) return `The conversation is too long (max ${MAX_TOTAL_CHARS} characters in total). Start a new chat.`;
  if (!turns[turns.length - 1].content.trim()) return "The last message is empty.";
  return turns[turns.length - 1].role === "user" ? { provider, model: b.model, turns } : "The last message must be from the user.";
}

