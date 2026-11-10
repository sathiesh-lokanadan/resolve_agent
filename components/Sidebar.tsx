import { CircleCheckBig, Plus, ScrollText } from "lucide-react";
import { MODELS, PROVIDERS, PROVIDER_INFO, type Provider } from "@/lib/types";
import ApiKeyBar from "./ApiKeyBar";

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-400">{children}</div>
);

const rowClass = (active: boolean) =>
  `flex w-full flex-col rounded-xl border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${
    active ? "border-black/70 bg-white shadow-sm" : "border-black/10 text-neutral-500 hover:border-black/30"
  }`;

export default function Sidebar({
  provider, onProvider, model, onModel, custom, onCustom, busy, onNew,
  hasKey, onSaveKey, onClearKey, callCount, onOpenLog,
}: {
  provider: Provider;
  onProvider: (p: Provider) => void;
  model: string;
  onModel: (id: string) => void;
  custom: boolean;
  onCustom: (on: boolean) => void;
  busy: boolean;
  onNew: () => void;
  hasKey: boolean;
  onSaveKey: (k: string) => void;
  onClearKey: () => void;
  callCount: number;
  onOpenLog: () => void;
}) {
  const info = PROVIDER_INFO[provider];
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
        <Label>Provider</Label>
        <div role="radiogroup" aria-label="Provider" className="flex rounded-full bg-black/5 p-0.5 text-sm">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={provider === p}
              disabled={busy}
              onClick={() => onProvider(p)}
              className={`flex-1 rounded-full px-2 py-1 transition disabled:opacity-60 ${provider === p ? "bg-white shadow-sm" : "text-neutral-500"}`}
            >
              {PROVIDER_INFO[p].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <Label>Model</Label>
        <div role="radiogroup" aria-label="Model" className="space-y-1.5">
          {MODELS[provider].map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={!custom && model === m.id}
              disabled={busy}
              onClick={() => { onCustom(false); onModel(m.id); }}
              className={rowClass(!custom && model === m.id)}
            >
              <span className={!custom && model === m.id ? "font-medium text-ink" : ""}>{m.label}</span>
              <span className="font-mono text-[11px] text-neutral-400">{m.id}</span>
            </button>
          ))}
          <button role="radio" aria-checked={custom} disabled={busy} onClick={() => { onCustom(true); onModel(""); }} className={rowClass(custom)}>
            <span className={custom ? "font-medium text-ink" : ""}>Other model id</span>
          </button>
          {custom && (
            <input
              autoFocus
              value={model}
              disabled={busy}
              onChange={(e) => onModel(e.target.value.trim())}
              placeholder="exact model id"
              aria-label="Custom model id"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-black/30"
            />
          )}
        </div>
      </section>

      <section>
        <Label>{info.keyLabel}</Label>
        <ApiKeyBar hasKey={hasKey} hint={info.keyHint} label={info.keyLabel} onSave={onSaveKey} onClear={onClearKey} />
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          Kept in this tab&apos;s sessionStorage and sent only as an x-api-key header, to the provider you chose. Never saved or logged.
        </p>
      </section>
    </aside>
  );
}
