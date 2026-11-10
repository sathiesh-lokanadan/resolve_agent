"use client";
import { useEffect, useRef } from "react";
import { Check, Loader2, ScrollText, X } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import ToolCallCard from "./ToolCallCard";

function StepList({ m }: { m: ChatMessage }) {
  return (
    <ol className="space-y-1 text-xs text-neutral-500">
      {m.steps.map((s, i) => {
        const active = i === m.steps.length - 1 && m.status === "working";
        return (
          <li key={i} className="flex items-center gap-1.5">
            {active ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} className="text-emerald-600" />}
            <span className={active ? "text-ink" : ""}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** The right-hand panel: every step and tool call, in order, with arguments and raw results. */
export default function LogPanel({ messages, open, onClose }: { messages: ChatMessage[]; open: boolean; onClose: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const turns = messages.filter((m) => m.role === "assistant");
  const total = turns.reduce((n, m) => n + m.calls.length, 0);

  return (
    <aside
      className={`card flex min-h-0 flex-col overflow-hidden max-lg:fixed max-lg:inset-y-3 max-lg:right-3 max-lg:z-30 max-lg:w-[min(92vw,380px)] ${open ? "" : "max-lg:hidden"}`}
    >
      <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3 text-sm font-medium">
        <ScrollText size={15} strokeWidth={1.75} /> Tool log
        <span className="text-xs font-normal text-neutral-400">{total} {total === 1 ? "call" : "calls"}</span>
        <button onClick={onClose} aria-label="Close tool log" className="ml-auto text-neutral-500 lg:hidden"><X size={16} /></button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        {turns.length === 0 && (
          <p className="px-1 py-6 text-center text-xs leading-relaxed text-neutral-400">
            Every step and tool call will appear here, with its arguments, timing and raw result.
          </p>
        )}
        {turns.map((m, i) => (
          <section key={m.id} className="space-y-2">
            <div className="truncate px-1 text-[11px] uppercase tracking-wide text-neutral-400">Turn {i + 1}{m.via ? ` · ${m.via}` : ""}</div>
            <StepList m={m} />
            {m.calls.map((c) => <ToolCallCard key={c.id} call={c} />)}
          </section>
        ))}
        <div ref={end} />
      </div>
    </aside>
  );
}
