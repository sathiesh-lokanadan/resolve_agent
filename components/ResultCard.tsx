import type { ApprovalState, CallView } from "@/lib/types";
import { TOOL_META } from "@/lib/tool-meta";
import type { ToolName } from "@/lib/types";
import ToolIcon from "./ToolIcon";
import ToolResult, { statusTone } from "./ToolResult";
import ApprovalCard from "./ApprovalCard";

/** One readable tool result in the chat, with its Approve / Reject buttons when it needs a human. */
export default function ResultCard({ call, onDecide }: { call: CallView; onDecide: (a: ApprovalState) => void }) {
  const r = call.result;
  if (!r) return null;
  const title = TOOL_META[call.name as ToolName]?.title ?? call.name;
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="text-neutral-500"><ToolIcon name={call.name} /></span>
        <span className="text-sm font-medium">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusTone(r.status)}`}>{r.status.replace("_", " ")}</span>
      </div>
      <ToolResult result={r} />
      {call.approval && <ApprovalCard name={call.name} approval={call.approval} onDecide={onDecide} />}
    </div>
  );
}
