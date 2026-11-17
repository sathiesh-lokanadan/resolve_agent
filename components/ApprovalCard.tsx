"use client";
import { useState } from "react";
import { Check, Clock, Loader2, RotateCcw, TriangleAlert, X } from "lucide-react";
import type { ApprovalState } from "@/lib/types";

const LABEL: Record<string, string> = {
  draft_reply: "Send this reply",
  issue_refund: "Issue this refund",
  create_bug_ticket: "File this bug ticket",
  escalate_to_human: "Escalate to a human",
};

function SlackLine({ slack, onRetry }: { slack?: ApprovalState["slack"]; onRetry?: () => void }) {
  if (!slack) return null;
  if (slack.state === "sending")
    return <p className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500"><Loader2 size={12} className="animate-spin" /> Posting to Slack…</p>;
  if (slack.state === "posted")
    return <p className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-600"><Check size={12} /> Update posted to Slack</p>;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-800">
      <TriangleAlert size={12} className="shrink-0" /> <span className="flex-1">Slack post failed: {slack.error}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-0.5 font-medium ring-1 ring-rose-200 hover:bg-rose-100">
          <RotateCcw size={11} /> Retry
        </button>
      )}
    </p>
  );
}

export default function ApprovalCard({
  name, approval, onDecide, onRetrySlack, waiting,
}: {
  name: string;
  approval: ApprovalState;
  onDecide: (a: ApprovalState, postToSlack: boolean) => void;
  onRetrySlack?: () => void;
  /** The agent is still writing its summary; refunds wait for it because the Slack post includes it. */
  waiting?: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [postToSlack, setPostToSlack] = useState(true);
  const isRefund = name === "issue_refund";
  const blocked = isRefund && !!waiting;

  if (approval.state === "approved")
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <Check size={15} /> Done (simulated)
        {isRefund && <SlackLine slack={approval.slack} onRetry={onRetrySlack} />}
      </div>
    );
  if (approval.state === "rejected")
    return (
      <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">
        <X size={15} className="mt-0.5 shrink-0" />
        <div>
          <span>Rejected: {approval.reason}</span>
          {isRefund && <SlackLine slack={approval.slack} onRetry={onRetrySlack} />}
        </div>
      </div>
    );

  return (
    <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock size={15} /> Approval required · {LABEL[name] ?? name}
      </div>
      {isRefund && (
        <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={postToSlack} onChange={(e) => setPostToSlack(e.target.checked)} className="size-4 accent-black" />
          Post an update on slack
        </label>
      )}
      {blocked && <p className="mt-1.5 text-xs text-neutral-500">Waiting for the agent to finish its summary…</p>}
      {rejecting ? (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim() && !blocked) onDecide({ state: "rejected", reason: reason.trim() }, postToSlack);
          }}
        >
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you rejecting it?"
            className="min-w-0 flex-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm outline-none focus:border-black/30"
          />
          <button disabled={!reason.trim() || blocked} className="pill-dark px-3.5 py-1.5 text-sm disabled:opacity-40">Reject</button>
          <button type="button" onClick={() => setRejecting(false)} className="rounded-full px-3 py-1.5 text-sm text-neutral-500">Cancel</button>
        </form>
      ) : (
        <div className="mt-2 flex gap-2">
          <button disabled={blocked} onClick={() => onDecide({ state: "approved" }, postToSlack)} className="pill-dark px-4 py-1.5 text-sm disabled:opacity-40">Approve</button>
          <button disabled={blocked} onClick={() => setRejecting(true)} className="rounded-full border border-black/15 bg-white px-4 py-1.5 text-sm disabled:opacity-40">Reject</button>
        </div>
      )}
    </div>
  );
}
