"use client";
import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";

export default function MessageBox({
  value, onChange, onSend, onStop, busy, disabled, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const canSend = !busy && !disabled && value.trim().length > 0;
  return (
    <div className="card flex items-end gap-2 p-2.5">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
        className="max-h-56 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-neutral-400"
      />
      {busy ? (
        <button onClick={onStop} className="pill-dark flex items-center gap-1.5 px-4 py-2 text-sm">
          <Square size={12} fill="currentColor" /> Stop
        </button>
      ) : (
        <button onClick={onSend} disabled={!canSend} className="pill-dark flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-30">
          Send <ArrowUp size={14} />
        </button>
      )}
    </div>
  );
}
