"use client";
import { useState } from "react";
import { Check, KeyRound } from "lucide-react";

export default function ApiKeyBar({
  hasKey, hint, label, onSave, onClear,
}: {
  hasKey: boolean;
  hint: string;
  label: string;
  onSave: (k: string) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState("");

  if (hasKey)
    return (
      <div className="space-y-1.5 text-sm">
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900">
          <Check size={14} /> Key set for this tab
        </p>
        <button onClick={onClear} className="px-1 text-xs text-neutral-500 underline">Remove key</button>
      </div>
    );

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim()) onSave(draft.trim());
      }}
    >
      <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 focus-within:border-black/30">
        <KeyRound size={14} className="shrink-0 text-neutral-500" />
        <input
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={hint}
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
      </div>
      <button disabled={!draft.trim()} className="pill-dark w-full px-4 py-2 text-sm disabled:opacity-30">Use key</button>
    </form>
  );
}
