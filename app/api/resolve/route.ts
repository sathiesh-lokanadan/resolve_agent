import { runAgent } from "@/lib/agent";
import { log } from "@/lib/log";
import { createSession, describeError } from "@/lib/providers";
import { MAX_BODY_BYTES, parseBody } from "@/lib/request";
import type { StreamEvent } from "@/lib/types";

export const maxDuration = 120;

const fail = (error: string, status: number, requestId: string) =>
  Response.json({ error }, { status, headers: { "x-request-id": requestId } });

export async function POST(req: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const apiKey = req.headers.get("x-api-key")?.trim();
  if (!apiKey) return fail("Add your API key first.", 401, requestId);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return fail("The request is too large.", 413, requestId);

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return fail("Could not read the request.", 400, requestId);
  }
  if (raw.length > MAX_BODY_BYTES) return fail("The request is too large.", 413, requestId);
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    /* parseBody reports it */
  }

  const parsed = parseBody(json);
  if (typeof parsed === "string") {
    log("request_rejected", { requestId, reason: parsed.slice(0, 80) }, "warn");
    return fail(parsed, 400, requestId);
  }

  const { provider, model, turns } = parsed;
  const encoder = new TextEncoder();
  const t0 = Date.now();
  log("request_start", { requestId, provider, model, turns: turns.length });

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          /* client went away */
        }
      };
      let outcome = "ok";
      try {
        const session = createSession(provider, { apiKey, model, turns, signal: req.signal });
        const history = turns.slice(0, -1).map((t) => t.content);
        await runAgent({ session, emit, signal: req.signal, history, requestId });
      } catch (err) {
        if (req.signal.aborted) outcome = "aborted";
        else {
          outcome = "error";
          const message = describeError(err, provider, apiKey);
          log("request_error", { requestId, provider, error: message.slice(0, 120) }, "error");
          emit({ type: "error", message });
        }
      }
      // `done` is always the last event, so the page can tell a finished stream from a dropped one.
      emit({ type: "done" });
      log("request_end", { requestId, outcome, ms: Date.now() - t0 });
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
      "x-request-id": requestId,
    },
  });
}
