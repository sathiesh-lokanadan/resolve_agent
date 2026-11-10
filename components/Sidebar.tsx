import { CircleCheckBig, Plus, ScrollText } from "lucide-react";
import { MODELS, type ModelId } from "@/lib/types";
import ApiKeyBar from "./ApiKeyBar";

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-400">{children}</div>
);

export default function Sidebar({
  model, onModel, busy, onNew, hasKey, onSaveKey, onClearKey, callCount, onOpenLog,
}: {
  model: ModelId;
  onModel: (m: ModelId) => void;
  busy: boolean;
  onNew: () => void;
  hasKey: boolean;
  onSaveKey: (k: string) => void;
  onClearKey: () => void;
  callCount: number;
  onOpenLog: () => void;
}) {
  return (
    <aside className="card flex flex-col gap-6 p-4 lg:min-h-0 lg:overflow-y-auto">
      <div className="flex items-center gap-2 font-semibold tracking-tight">
        <CircleCheckBig size={20} strokeWidth={1.75} /> Resolve
      </div>

      <div className="flex gap-2 lg:flex-col">
        <button onClick={onNew} className="pill-dark flex flex-1 items-center justify-center gap-1.5 px-3.5 py-2 text-sm">
          <Plus size={14} /> New chat
        </button>
        <button
          onClick={onOpenLog}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-black/15 bg-white px-3.5 py-2 text-sm lg:hidden"
        >
          <ScrollText size={14} /> Tool log ({callCount})
        </button>
      </div>

      <section>
        <Label>Model</Label>
        <div role="radiogroup" aria-label="Model" className="space-y-1.5">
          {MODELS.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={model === m.id}
              disabled={busy}
              onClick={() => onModel(m.id)}
              className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${
                model === m.id ? "border-black/70 bg-white shadow-sm" : "border-black/10 text-neutral-500 hover:border-black/30"
              }`}
            >
              <span className={model === m.id ? "font-medium text-ink" : ""}>{m.label}</span>
              <span className="font-mono text-[11px] text-neutral-400">{m.id}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <Label>Anthropic API key</Label>
        <ApiKeyBar hasKey={hasKey} onSave={onSaveKey} onClear={onClearKey} />
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          Kept in this tab&apos;s sessionStorage and sent only as an x-api-key header. Never saved or logged.
        </p>
      </section>
    </aside>
  );
}
