import type { ToolName } from "./types";

export const TOOL_META: Record<ToolName, { kind: "read" | "action"; title: string; blurb: string }> = {
  route_ticket: { kind: "read", title: "Routing", blurb: "Category, urgency and confidence" },
  search_kb: { kind: "read", title: "Knowledge base matches", blurb: "Vector search, top 3 articles" },
  lookup_customer: { kind: "read", title: "Customer", blurb: "Profile, orders, refund history" },
  draft_reply: { kind: "action", title: "Draft reply", blurb: "Cited reply, needs approval" },
  issue_refund: { kind: "action", title: "Refund proposal", blurb: "30-day window, 200 USD cap" },
  create_bug_ticket: { kind: "action", title: "Bug ticket", blurb: "Title, steps, severity" },
  escalate_to_human: { kind: "action", title: "Escalation", blurb: "Reason and summary" },
};
