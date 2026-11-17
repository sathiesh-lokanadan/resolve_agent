import type { ApprovalState, ChatMessage } from "./types";

/** Builds the Slack payload for one refund decision from the chat. Returns null if this is not a refund. */
export function buildSlackPayload(messages: ChatMessage[], msgId: string, callId: string, approval: ApprovalState) {
  const at = messages.findIndex((m) => m.id === msgId);
  const msg = messages[at];
  const call = msg?.calls.find((c) => c.id === callId);
  if (!msg || !call || call.name !== "issue_refund" || approval.state === "pending") return null;
  const data = (call.result?.data ?? {}) as Record<string, unknown>;
  const query = [...messages.slice(0, at)].reverse().find((m) => m.role === "user")?.text ?? "";
  const bugs = msg.calls
    .filter((c) => c.name === "create_bug_ticket" && c.result?.status === "pending_approval")
    .map((c) => {
      const d = (c.result?.data ?? {}) as Record<string, unknown>;
      const state = c.approval?.state ?? "pending";
      return { id: d.bug_id, title: d.title, steps: d.steps, severity: d.severity, status: state };
    });
  return {
    query,
    summary: msg.text,
    decision: approval.state,
    reason: approval.state === "rejected" ? approval.reason : undefined,
    refund: { orderId: data.order_id, customer: data.customer, amount: data.amount, reason: data.reason },
    bugs,
  };
}

export async function sendSlackUpdate(payload: unknown): Promise<void> {
  const res = await fetch("/api/slack/notify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Slack post failed (${res.status}).`);
  }
}
