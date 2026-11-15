import { PRESETS } from "@/lib/presets";

export default function Welcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="space-y-8 pt-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Resolve a ticket</h1>
        <p className="mx-auto max-w-md text-sm text-neutral-500">
          Paste a ticket. Every fact comes from a tool call you can open, and nothing goes out until you approve it.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onPick(p.text)}
            className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-sm shadow-sm transition hover:border-black/30"
          >
            <span className={`h-2 w-2 rounded-full ${p.dot}`} /> {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
