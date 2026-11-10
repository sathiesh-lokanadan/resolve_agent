import { Check, Loader2, Square, TriangleAlert } from "lucide-react";
import type { ApprovalState, ChatMessage } from "@/lib/types";
import ToolCallCard from "./ToolCallCard";
import Markdown from "./Markdown";

function Steps({ m }: { m: ChatMessage }) {
  if (!m.steps.length) return null;
  return (
    <ol className="space-y-1 text-sm text-neutral-500">
      {m.steps.map((s, i) => {
        const last = i === m.steps.length - 1;
        const active = last && m.status === "working";
        return (
          <li key={i} className="flex items-center gap-2">
            {active ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} className="text-emerald-600" />}
            <span className={active ? "text-ink" : ""}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Assistant({ m, onDecide }: { m: ChatMessage; onDecide: (callId: string, a: ApprovalState) => void }) {
  return (
    <div className="space-y-3">
      <Steps m={m} />
      {m.calls.map((c) => (
        <ToolCallCard key={c.id} call={c} onDecide={(a) => onDecide(c.id, a)} />
      ))}
      {m.text && <div className="card p-5"><Markdown text={m.text} /></div>}
      {m.status === "stopped" && (
        <p className="flex items-center gap-2 text-sm text-neutral-500"><Square size={12} /> Stopped.</p>
      )}
      {m.status === "error" && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">
          <TriangleAlert size={14} /> {m.error}
        </p>
      )}
    </div>
  );
}

export default function Thread({
  messages, onDecide,
}: {
  messages: ChatMessage[];
  onDecide: (msgId: string, callId: string, a: ApprovalState) => void;
}) {
  return (
    <div className="space-y-6">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-3 text-sm leading-relaxed text-white">
              {m.text}
            </div>
          </div>
        ) : (
          <Assistant key={m.id} m={m} onDecide={(callId, a) => onDecide(m.id, callId, a)} />
        ),
      )}
    </div>
  );
}
