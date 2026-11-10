"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";

export default function ApiKeyBar({ hasKey, onSave, onClear }: { hasKey: boolean; onSave: (k: string) => void; onClear: () => void }) {
  const [draft, setDraft] = useState("");

  if (hasKey)
    return (
      <p className="flex items-center justify-center gap-2 text-xs text-neutral-500">
        <KeyRound size={12} /> API key kept in this tab only.
        <button onClick={onClear} className="underline">Remove</button>
      </p>
    );

  return (
    <form
      className="card flex flex-wrap items-center gap-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim()) onSave(draft.trim());
      }}
    >
      <KeyRound size={16} className="ml-1 text-neutral-500" />
      <input
        type="password"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste your Anthropic API key (sk-ant-…)"
        className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-neutral-400"
      />
      <button disabled={!draft.trim()} className="pill-dark px-4 py-1.5 text-sm disabled:opacity-30">Use key</button>
      <p className="w-full px-1 text-xs text-neutral-400">Stored in sessionStorage, sent only as an x-api-key header, never saved or logged.</p>
    </form>
  );
}
