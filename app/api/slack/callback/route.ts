import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { readSession } from "@/lib/auth";
import { SLACK_MCP_URL, SlackAuthProvider, supabaseStore } from "@/lib/slack-oauth";

const page = (msg: string, status = 200) =>
  new Response(`<!doctype html><meta charset="utf-8"><title>Slack</title><body style="font-family:system-ui;padding:2rem"><p>${msg}</p><p><a href="/">Back to Resolve</a></p>`, {
    status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });

/** Slack redirects here after the user approves. Checks the state value, then trades the code for tokens. */
export async function GET(req: Request) {
  if (!readSession(req.headers.get("cookie"))) return page("Please sign in to Resolve first, then start again at /api/slack/connect.", 401);
  const q = new URL(req.url).searchParams;
  if (q.get("error")) return page("Slack did not authorise the connection.", 400);
  const code = q.get("code");
  if (!code) return page("Missing authorization code.", 400);
  const store = supabaseStore();
  try {
    const saved = (await store.load()).state;
    if (!saved || saved !== q.get("state")) return page("The connection attempt does not match (bad state). Start again at /api/slack/connect.", 400);
    const redirectUrl = process.env.SLACK_REDIRECT_URL?.trim() || new URL("/api/slack/callback", req.url).toString();
    const result = await auth(new SlackAuthProvider(store, redirectUrl, true), { serverUrl: SLACK_MCP_URL, authorizationCode: code });
    return result === "AUTHORIZED" ? page("Slack is connected. Refund decisions can now post updates.") : page("Slack did not complete the connection.", 502);
  } catch (e) {
    return page(`Could not complete the Slack connection: ${(e instanceof Error ? e.message : "error").slice(0, 160).replace(/[<>&]/g, "")}`, 502);
  }
}
