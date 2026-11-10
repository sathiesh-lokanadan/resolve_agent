export const TOOL_NAMES = [
  "route_ticket",
  "search_kb",
  "lookup_customer",
  "draft_reply",
  "issue_refund",
  "create_bug_ticket",
  "escalate_to_human",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const ACTION_TOOLS: readonly string[] = [
  "draft_reply",
  "issue_refund",
  "create_bug_ticket",
  "escalate_to_human",
];

export const CATEGORIES = ["how_to", "billing", "bug", "account", "other"] as const;
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type ToolStatus = "ok" | "not_found" | "rejected" | "needs_human" | "pending_approval" | "error";

/** What every tool returns: the data plus where it came from and when. */
export interface ToolEnvelope {
  tool: string;
  status: ToolStatus;
  source: string;
  fetchedAt: string;
  fixtureId: string | null;
  note: string;
  message?: string;
  errors?: string[];
  data?: unknown;
}

export type StreamEvent =
  | { type: "step"; label: string }
  | { type: "tool_start"; id: string; name: string; args: unknown }
  | { type: "tool_end"; id: string; name: string; ms: number; result: ToolEnvelope }
  | { type: "approval"; id: string; name: string; action: unknown }
  | { type: "answer"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ApprovalState {
  state: "pending" | "approved" | "rejected";
  reason?: string;
}

export interface CallView {
  id: string;
  name: string;
  args: unknown;
  ms?: number;
  result?: ToolEnvelope;
  approval?: ApprovalState;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps: string[];
  calls: CallView[];
  status: "working" | "done" | "stopped" | "error";
  error?: string;
}

export const MODELS = [
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5" },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];

export interface Turn {
  role: "user" | "assistant";
  content: string;
}
