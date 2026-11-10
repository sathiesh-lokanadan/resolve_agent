import Anthropic from "@anthropic-ai/sdk";
import { runAgent } from "@/lib/agent";
import { MODELS, type StreamEvent, type Turn } from "@/lib/types";

export const maxDuration = 120;

function parseBody(body: unknown): { model: string; turns: Turn[] } | string {
  const b = body as { model?: unknown; messages?: unknown } | null;
  if (!b || !MODELS.some((m) => m.id === b.model)) return "Unknown model.";
  const list = b.messages;
  if (!Array.isArray(list) || !list.length || list.length > 40) return "messages must be a list of 1 to 40 turns.";
  const turns: Turn[] = [];
  for (const m of list) {
    const ok = m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= 12000;
    if (!ok) return "Each message needs a role and text (max 12000 characters).";
    turns.push({ role: m.role, content: m.content });
  }
  return turns[turns.length - 1].role === "user" ? { model: b.model as string, turns } : "The last message must be from the user.";
}

function describe(err: unknown, apiKey: string): string {
  if (err instanceof Anthropic.AuthenticationError) return "Anthropic rejected the API key.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key is not allowed to use that model.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by Anthropic. Wait a moment and try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the Anthropic API.";
  const msg = err instanceof Error ? err.message : "Unexpected error.";
  return msg.split(apiKey).join("[key]");
}

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key")?.trim();
  if (!apiKey) return Response.json({ error: "Add your Anthropic API key first." }, { status: 401 });

  const parsed = parseBody(await req.json().catch(() => null));
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });

  const client = new Anthropic({ apiKey, maxRetries: 1 });
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
        await runAgent({ client, model: parsed.model, turns: parsed.turns, emit, signal: req.signal });
      } catch (err) {
        if (!req.signal.aborted) emit({ type: "error", message: describe(err, apiKey) });
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
