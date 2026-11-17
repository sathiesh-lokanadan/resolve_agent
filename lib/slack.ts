import { redact } from "./redact";

/** Write-only Slack integration. The server talks to a Slack MCP server and only ever calls its "post message" tool. */

export interface SlackBug {
  id: string;
  title: string;
  steps: string[];
  severity: string;
  status: "pending" | "approved" | "rejected";
}

export interface SlackUpdate {
  query: string;
  summary: string;
  decision: "approved" | "rejected";
  /** The human's reason, when they rejected. */
  reason?: string;
  refund: { orderId: string; customer: string; amount: number; reason: string };
  bugs: SlackBug[];
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validates the browser's payload. Returns the cleaned update, or a message saying what is wrong. */
export function parseSlackUpdate(json: unknown): SlackUpdate | string {
  const b = json as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return "Send a JSON object.";
  if (b.decision !== "approved" && b.decision !== "rejected") return "decision must be approved or rejected.";
  const r = b.refund as Record<string, unknown> | undefined;
  if (!r || typeof r !== "object") return "A refund is required: Slack updates are only sent for refunds.";
  const amount = typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0 ? Math.round(r.amount * 100) / 100 : 0;
  const orderId = text(r.orderId, 40);
  if (!orderId || !amount) return "refund needs an orderId and a positive amount.";
  const query = text(b.query, 4000);
  const summary = text(b.summary, 6000);
  if (!query) return "query is required.";
  if (!summary) return "summary is required.";
  const reason = text(b.reason, 500);
  if (b.decision === "rejected" && !reason) return "A rejected refund needs the reason.";
  const bugs = (Array.isArray(b.bugs) ? b.bugs : []).slice(0, 5).flatMap((x): SlackBug[] => {
    const o = x as Record<string, unknown> | null;
    const id = text(o?.id, 20);
    const status = o?.status;
    if (!o || !/^BUG-\d{3,}$/.test(id) || (status !== "pending" && status !== "approved" && status !== "rejected")) return [];
    const steps = (Array.isArray(o.steps) ? o.steps : []).filter((s): s is string => typeof s === "string").slice(0, 12).map((s) => s.slice(0, 300));
    return [{ id, title: text(o.title, 140), steps, severity: text(o.severity, 20), status }];
  });
  return {
    query, summary, decision: b.decision, reason: reason || undefined, bugs,
    refund: { orderId, customer: text(r.customer, 80), amount, reason: text(r.reason, 500) },
  };
}

/** Slack treats & < > as markup, so a ticket cannot ping @channel or inject links. */
const escapeSlack = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Redact personal data, cut to length, make it safe for Slack. */
const clean = (s: string, max: number) => {
  const r = redact(s);
  return escapeSlack(r.length > max ? `${r.slice(0, max).trimEnd()}…` : r);
};
const quote = (s: string) => s.split("\n").map((l) => `> ${l}`).join("\n");
/** The agent writes Markdown; Slack uses *bold* and has no headings. */
const toMrkdwn = (s: string) => s.replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.+?)\*\*/g, "*$1*");
const usd = (n: number) => `$${n.toFixed(2)} USD`;
const BUG_STATUS = { approved: "filed", pending: "proposed, awaiting approval", rejected: "rejected" } as const;

export function formatSlackMessage(u: SlackUpdate, decidedBy: string): string {
  const approved = u.decision === "approved";
  const lines = [
    `${approved ? ":white_check_mark:" : ":x:"} *Refund ${u.decision}* · order ${clean(u.refund.orderId, 40)}`,
    "",
    "*Customer query*",
    quote(clean(u.query, 1200)),
    "",
    "*Case summary (agent)*",
    quote(clean(toMrkdwn(u.summary), 1500)),
    "",
    `*Final decision:* ${approved ? "Approved" : "Rejected"} by ${clean(decidedBy, 60)}`,
  ];
  if (u.reason) lines.push(`*Rejection reason:* ${clean(u.reason, 500)}`);
  lines.push(
    "",
    approved ? "*Refund being processed*" : "*Refund requested (not processed)*",
    `• Order: ${clean(u.refund.orderId, 40)}`,
    `• Customer: ${clean(u.refund.customer, 80)}`,
    `• Amount: ${usd(u.refund.amount)}`,
    `• Reason: ${clean(u.refund.reason, 300)}`,
  );
  for (const bug of u.bugs) {
    lines.push("", `:beetle: *${bug.id}* (${BUG_STATUS[bug.status]})`, `• Severity: ${clean(bug.severity, 20)}`, `• Description: ${clean(bug.title, 140)}`);
    bug.steps.forEach((s, i) => lines.push(`   ${i + 1}. ${clean(s, 300)}`));
  }
  return lines.join("\n");
}

export type McpCall = (tool: string, args: Record<string, string>) => Promise<{ isError?: boolean; content?: unknown }>;
export type SlackResult = { ok: true } | { ok: false; error: string; status: number };

export const slackConfigured = () => !!(process.env.SLACK_BOT_TOKEN?.trim() && process.env.SLACK_TEAM_ID?.trim() && process.env.SLACK_CHANNEL_ID?.trim());
const SLACK_TIMEOUT_MS = 20_000;

/** Starts the Slack MCP server (stdio), calls one tool, and shuts it down. */
export const callSlackMcp: McpCall = async (tool, args) => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport, getDefaultEnvironment } = await import("@modelcontextprotocol/sdk/client/stdio.js");
  const command = process.env.SLACK_MCP_COMMAND?.trim() || "npx";
  const cmdArgs = process.env.SLACK_MCP_ARGS?.trim() ? process.env.SLACK_MCP_ARGS.trim().split(/\s+/) : ["-y", "@modelcontextprotocol/server-slack"];
  const transport = new StdioClientTransport({
    command, args: cmdArgs,
    env: { ...getDefaultEnvironment(), SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN!.trim(), SLACK_TEAM_ID: process.env.SLACK_TEAM_ID!.trim() },
    stderr: "ignore",
  });
  const client = new Client({ name: "resolve", version: "0.1.0" });
  try {
    await client.connect(transport);
    return (await client.callTool({ name: tool, arguments: args }, undefined, { timeout: SLACK_TIMEOUT_MS })) as { isError?: boolean; content?: unknown };
  } finally {
    await client.close().catch(() => {});
  }
};

/** The community Slack server returns Slack's JSON reply as text and does not flag { ok: false }. */
function failure(res: Awaited<ReturnType<McpCall>>): string | null {
  const first = Array.isArray(res.content) ? (res.content[0] as { type?: string; text?: string } | undefined) : undefined;
  const body = first?.type === "text" ? first.text ?? "" : "";
  if (res.isError) return body.slice(0, 120) || "the Slack MCP server returned an error";
  try {
    const parsed = JSON.parse(body);
    if (parsed && parsed.ok === false) return String(parsed.error ?? "unknown_error").slice(0, 80);
  } catch {
    /* not JSON: nothing to check */
  }
  return null;
}

/** Posts one message to the configured channel. Never throws and never includes secrets in the error. */
export async function postToSlack(message: string, call: McpCall = callSlackMcp): Promise<SlackResult> {
  if (!slackConfigured()) return { ok: false, status: 503, error: "Slack is not configured on the server (SLACK_BOT_TOKEN, SLACK_TEAM_ID and SLACK_CHANNEL_ID)." };
  const guard = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), SLACK_TIMEOUT_MS + 2000).unref?.());
  try {
    const res = await Promise.race([call("slack_post_message", { channel_id: process.env.SLACK_CHANNEL_ID!.trim(), text: message }), guard]);
    const why = failure(res);
    return why ? { ok: false, status: 502, error: `Slack rejected the post: ${why}` } : { ok: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message.replaceAll(process.env.SLACK_BOT_TOKEN!.trim(), "[token]").slice(0, 120) : "";
    return { ok: false, status: 502, error: `Could not reach the Slack MCP server${detail ? `: ${detail}` : "."}` };
  }
}
