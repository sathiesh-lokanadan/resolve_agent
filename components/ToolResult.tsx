import type { ToolEnvelope } from "@/lib/types";
import RoutingBadge, { type Routing } from "./RoutingBadge";
import { CustomerCard, DraftReply, Facts, KbChips } from "./ResultParts";

/* eslint-disable @typescript-eslint/no-explicit-any */
function Body({ r }: { r: ToolEnvelope }) {
  const data = r.data as any;
  if (r.status === "ok" || r.status === "pending_approval") {
    if (r.tool === "route_ticket") return <RoutingBadge {...(data as Routing)} />;
    if (r.tool === "search_kb")
      return (
        <div className="space-y-1.5">
          <KbChips matches={data.matches} />
          <p className="text-[11px] text-neutral-400">Retrieved by {data.method}. Hover a chip to read the passage.</p>
        </div>
      );
    if (r.tool === "lookup_customer") return <CustomerCard data={data} />;
    if (r.tool === "draft_reply") return <DraftReply data={data} />;
    if (data) return <Facts data={data} />;
  }
  return null;
}

const TONE: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-800",
  pending_approval: "bg-amber-50 text-amber-800",
  not_found: "bg-neutral-100 text-neutral-700",
  needs_human: "bg-orange-50 text-orange-800",
  rejected: "bg-rose-50 text-rose-800",
  error: "bg-rose-50 text-rose-800",
};

export const statusTone = (s: string) => TONE[s] ?? TONE.error;

export default function ToolResult({ result }: { result: ToolEnvelope }) {
  return (
    <div className="space-y-2.5">
      <Body r={result} />
      {result.message && <p className="text-sm text-neutral-600">{result.message}</p>}
      {result.errors && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-rose-800">
          {result.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <p className="text-[11px] text-neutral-400">
        Source {result.source} · fetched {new Date(result.fetchedAt).toLocaleTimeString()} · fixture {result.fixtureId ?? "none"}
      </p>
    </div>
  );
}
