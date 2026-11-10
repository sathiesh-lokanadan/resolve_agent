import { CircleCheckBig, Plus } from "lucide-react";
import { MODELS, type ModelId } from "@/lib/types";

export default function Header({
  model, onModel, onNew, busy,
}: {
  model: ModelId;
  onModel: (m: ModelId) => void;
  onNew: () => void;
  busy: boolean;
}) {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-5">
      <div className="flex items-center gap-2 font-semibold tracking-tight">
        <CircleCheckBig size={20} strokeWidth={1.75} /> Resolve
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div role="radiogroup" aria-label="Model" className="flex rounded-full bg-black/5 p-0.5 text-sm">
          {MODELS.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={model === m.id}
              disabled={busy}
              onClick={() => onModel(m.id)}
              className={`rounded-full px-3 py-1 transition ${model === m.id ? "bg-white shadow-sm" : "text-neutral-500"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button onClick={onNew} className="pill-dark flex items-center gap-1.5 px-3.5 py-1.5 text-sm">
          <Plus size={14} /> New chat
        </button>
      </div>
    </header>
  );
}
