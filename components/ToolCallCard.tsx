"use client";
import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { CallView } from "@/lib/types";
import ToolIcon from "./ToolIcon";
import { statusTone } from "./ToolResult";

const Json = ({ label, value }: { label: string; value: unknown }) => (
  <div>
    <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-400">{label}</div>
    <pre className="max-h-56 overflow-auto rounded-lg bg-neutral-50 p-2.5 font-mono text-[11px] leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  </div>
);

const APPROVAL_TONE = { pending: "text-amber-700", approved: "text-emerald-700", rejected: "text-rose-700" };

/** One line of the tool log: name, status, timing. Open it for the arguments and the raw JSON. */
export default function ToolCallCard({ call }: { call: CallView }) {
  const [open, setOpen] = useState(false);
  const r = call.result;

  return (
    <div className="rounded-xl border border-black/[0.07] bg-white">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <span className="text-neutral-500"><ToolIcon name={call.name} size={14} /></span>
        <span className="truncate font-mono text-xs">{call.name}</span>
        {r ? (
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${statusTone(r.status)}`}>{r.status.replace("_", " ")}</span>
        ) : (
          <Loader2 size={12} className="animate-spin text-neutral-400" />
        )}
        {call.ms != null && <span className="shrink-0 text-[11px] text-neutral-400">{call.ms} ms</span>}
        <ChevronDown size={14} className={`ml-auto shrink-0 text-neutral-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {call.approval && (
        <p className={`px-3 pb-2 text-[11px] ${APPROVAL_TONE[call.approval.state]}`}>
          Human decision: {call.approval.state}{call.approval.reason ? ` (${call.approval.reason})` : ""}
        </p>
      )}
      {open && (
        <div className="space-y-2.5 border-t border-black/5 px-3 py-2.5">
          <Json label="Arguments" value={call.args} />
          {r && (
            <>
              <Json label="Raw result" value={r} />
              <p className="text-[11px] text-neutral-400">
                Source {r.source} · fetched {new Date(r.fetchedAt).toLocaleTimeString()} · fixture {r.fixtureId ?? "none"}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
