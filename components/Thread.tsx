import { Loader2, RotateCcw, Square, TriangleAlert } from "lucide-react";
import type { ApprovalState, ChatMessage } from "@/lib/types";
import ResultCard from "./ResultCard";
import Markdown from "./Markdown";

function Assistant({ m, onDecide, onRetry }: { m: ChatMessage; onDecide: (callId: string, a: ApprovalState) => void; onRetry?: () => void }) {
  return (
    <div className="space-y-3">
      {m.calls.map((c) => (
        <ResultCard key={c.id} call={c} onDecide={(a) => onDecide(c.id, a)} />
      ))}
      {m.status === "working" && (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 size={13} className="animate-spin" /> {m.steps[m.steps.length - 1] ?? "Working"}…
        </p>
      )}
      {m.text && <div className="card p-5"><Markdown text={m.text} /></div>}
      {m.status === "stopped" && (
        <p className="flex items-center gap-2 text-sm text-neutral-500"><Square size={12} /> Stopped.</p>
      )}
      {m.status === "error" && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">
          <TriangleAlert size={14} className="shrink-0" /> <span className="flex-1">{m.error}{m.calls.length > 0 && " Tool results above are kept; nothing was approved."}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-medium text-rose-900 ring-1 ring-rose-200 hover:bg-rose-100">
              <RotateCcw size={12} /> Retry
            </button>
          )}
        </p>
      )}
    </div>
  );
}

export default function Thread({
  messages, onDecide, onRetry,
}: {
  messages: ChatMessage[];
  onDecide: (msgId: string, callId: string, a: ApprovalState) => void;
  onRetry?: () => void;
}) {
  return (
    <div className="space-y-6">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-3 text-sm leading-relaxed text-white">
              {m.text}
            </div>
          </div>
        ) : (
          <Assistant key={m.id} m={m} onDecide={(callId, a) => onDecide(m.id, callId, a)} onRetry={i === messages.length - 1 ? onRetry : undefined} />
        ),
      )}
    </div>
  );
}
