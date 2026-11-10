"use client";
import { useState } from "react";
import { Check, Clock, X } from "lucide-react";
import type { ApprovalState } from "@/lib/types";

const LABEL: Record<string, string> = {
  draft_reply: "Send this reply",
  issue_refund: "Issue this refund",
  create_bug_ticket: "File this bug ticket",
  escalate_to_human: "Escalate to a human",
};

export default function ApprovalCard({
  name, approval, onDecide,
}: {
  name: string;
  approval: ApprovalState;
  onDecide: (a: ApprovalState) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  if (approval.state === "approved")
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <Check size={15} /> Done (simulated)
      </div>
    );
  if (approval.state === "rejected")
    return (
      <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">
        <X size={15} className="mt-0.5 shrink-0" /> <span>Rejected: {approval.reason}</span>
      </div>
    );

  return (
    <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock size={15} /> Approval required · {LABEL[name] ?? name}
      </div>
      {rejecting ? (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) onDecide({ state: "rejected", reason: reason.trim() });
          }}
        >
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you rejecting it?"
            className="min-w-0 flex-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm outline-none focus:border-black/30"
          />
          <button disabled={!reason.trim()} className="pill-dark px-3.5 py-1.5 text-sm disabled:opacity-40">Reject</button>
          <button type="button" onClick={() => setRejecting(false)} className="rounded-full px-3 py-1.5 text-sm text-neutral-500">Cancel</button>
        </form>
      ) : (
        <div className="mt-2 flex gap-2">
          <button onClick={() => onDecide({ state: "approved" })} className="pill-dark px-4 py-1.5 text-sm">Approve</button>
          <button onClick={() => setRejecting(true)} className="rounded-full border border-black/15 bg-white px-4 py-1.5 text-sm">Reject</button>
        </div>
      )}
    </div>
  );
}
