import { TOOL_META } from "@/lib/tool-meta";
import { TOOL_NAMES } from "@/lib/types";
import ToolIcon from "./ToolIcon";

/** The seven tools, pinned at the top of the right panel. */
export default function ToolsPanel() {
  return (
    <section className="max-h-[55%] shrink-0 overflow-y-auto border-b border-black/5 px-3 py-3">
      <div className="mb-2 px-1 text-[11px] uppercase tracking-wide text-neutral-400">Seven tools</div>
      <ul className="space-y-1.5">
        {TOOL_NAMES.map((n) => (
          <li key={n} className="flex items-start gap-2 rounded-lg border border-black/5 px-2.5 py-1">
            <span className="mt-0.5 text-neutral-500"><ToolIcon name={n} size={14} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs">{n}</span>
                <span className="text-[9px] uppercase tracking-wide text-neutral-400">{TOOL_META[n].kind}</span>
              </div>
              <div className="text-[11px] leading-snug text-neutral-500">{TOOL_META[n].blurb}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
