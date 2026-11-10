"use client";
import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { ApprovalState, CallView } from "@/lib/types";
import ToolIcon from "./ToolIcon";
import ToolResult, { statusTone } from "./ToolResult";
import ApprovalCard from "./ApprovalCard";

const Json = ({ label, value }: { label: string; value: unknown }) => (
  <div>
    <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
    <pre className="max-h-64 overflow-auto rounded-xl bg-neutral-50 p-3 font-mono text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  </div>
);

export default function ToolCallCard({ call, onDecide }: { call: CallView; onDecide: (a: ApprovalState) => void }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(false);
  const r = call.result;

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left">
        <span className="text-neutral-500"><ToolIcon name={call.name} /></span>
        <span className="font-mono text-sm">{call.name}</span>
        {r ? (
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusTone(r.status)}`}>{r.status.replace("_", " ")}</span>
        ) : (
          <Loader2 size={14} className="animate-spin text-neutral-400" />
        )}
        {call.ms != null && <span className="text-xs text-neutral-400">{call.ms} ms</span>}
        <ChevronDown size={15} className={`ml-auto text-neutral-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {call.approval && (
        <div className="px-3.5 pb-3"><ApprovalCard name={call.name} approval={call.approval} onDecide={onDecide} /></div>
      )}

      {open && (
        <div className="space-y-3 border-t border-black/5 px-3.5 py-3">
          <Json label="Arguments" value={call.args} />
          {r && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-neutral-400">Result</span>
                <button onClick={() => setRaw(!raw)} className="text-xs text-neutral-500 underline">
                  {raw ? "Readable" : "Raw JSON"}
                </button>
              </div>
              {raw ? <Json label="Raw JSON" value={r} /> : <ToolResult result={r} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
