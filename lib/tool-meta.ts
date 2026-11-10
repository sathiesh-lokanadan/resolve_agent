import type { ToolName } from "./types";

export const TOOL_META: Record<ToolName, { kind: "read" | "action"; blurb: string }> = {
  route_ticket: { kind: "read", blurb: "Category, urgency and confidence" },
  search_kb: { kind: "read", blurb: "Top 3 help-centre articles" },
  lookup_customer: { kind: "read", blurb: "Profile, orders, refund history" },
  draft_reply: { kind: "action", blurb: "Cited reply, needs approval" },
  issue_refund: { kind: "action", blurb: "30-day window, 200 USD cap" },
  create_bug_ticket: { kind: "action", blurb: "Title, steps, severity" },
  escalate_to_human: { kind: "action", blurb: "Reason and summary" },
};
