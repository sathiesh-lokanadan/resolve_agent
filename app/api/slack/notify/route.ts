import { readSession } from "@/lib/auth";
import { log } from "@/lib/log";
import { formatSlackMessage, parseSlackUpdate, postToSlack } from "@/lib/slack";

const MAX_BODY = 40_000;
export const maxDuration = 60;

/** Called by the browser after a human approves or rejects a refund. Write-only: nothing is read from Slack. */
export async function POST(req: Request) {
  const name = readSession(req.headers.get("cookie"));
  if (!name) return Response.json({ error: "Please sign in." }, { status: 401 });
  const raw = await req.text().catch(() => "");
  if (raw.length > MAX_BODY) return Response.json({ error: "The request is too large." }, { status: 413 });
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const update = parseSlackUpdate(json);
  if (typeof update === "string") return Response.json({ error: update }, { status: 400 });

  const result = await postToSlack(formatSlackMessage(update, name));
  log("slack_post", { ok: result.ok, decision: update.decision, status: result.ok ? 200 : result.status }, result.ok ? "info" : "warn");
  return result.ok ? Response.json({ ok: true }) : Response.json({ error: result.error }, { status: result.status });
}
