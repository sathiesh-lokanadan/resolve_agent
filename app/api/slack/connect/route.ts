import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { readSession } from "@/lib/auth";
import { SLACK_MCP_URL, SlackAuthProvider, supabaseStore } from "@/lib/slack-oauth";

/** One-time setup: sends a signed-in user to Slack to authorise the MCP connection. Posts then appear as that Slack user. */
export async function GET(req: Request) {
  if (!readSession(req.headers.get("cookie"))) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!process.env.SLACK_CLIENT_ID?.trim()) return Response.json({ error: "SLACK_CLIENT_ID is not set." }, { status: 503 });
  const redirectUrl = process.env.SLACK_REDIRECT_URL?.trim() || new URL("/api/slack/callback", req.url).toString();
  const provider = new SlackAuthProvider(supabaseStore(), redirectUrl, true);
  try {
    const result = await auth(provider, { serverUrl: SLACK_MCP_URL, scope: process.env.SLACK_OAUTH_SCOPE?.trim() || "chat:write" });
    if (result === "REDIRECT" && provider.authorizationUrl) return Response.redirect(provider.authorizationUrl.toString(), 302);
    return new Response("Slack is already connected.", { headers: { "content-type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.slice(0, 200) : "Could not start the Slack connection." }, { status: 502 });
  }
}
