import { BookOpen } from "lucide-react";

type Row = Record<string, unknown>;
const money = (n: unknown) => `$${Number(n).toFixed(2)}`;

export function KbChips({ matches }: { matches: { id: string; title: string; similarity?: number; text?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {matches.map((m) => (
        <span key={m.id} title={m.text} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs">
          <BookOpen size={12} /> <span className="font-mono text-neutral-500">{m.id}</span> {m.title}
          {m.similarity != null && <span className="text-neutral-400">· {m.similarity.toFixed(2)}</span>}
        </span>
      ))}
    </div>
  );
}

export function CustomerCard({ data }: { data: { profile: Row; today: string; orders: Row[]; refunds: Row[] } }) {
  const p = data.profile;
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="font-medium">{String(p.name)} <span className="font-normal text-neutral-500">· {String(p.company)}</span></div>
        <div className="text-xs text-neutral-500">
          {String(p.plan)} · signed up {String(p.signupDate)} · {String(p.country)} · {String(p.email)} · {String(p.phone)}
        </div>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="text-neutral-400">
          <tr><th className="py-1 font-normal">Order</th><th className="font-normal">Date</th><th className="font-normal">Age</th><th className="text-right font-normal">Amount</th></tr>
        </thead>
        <tbody>
          {data.orders.map((o) => (
            <tr key={String(o.id)} className="border-t border-black/5">
              <td className="py-1.5 font-mono">{String(o.id)}</td>
              <td>{String(o.date)}</td>
              <td>{String(o.ageDays)} d</td>
              <td className="text-right">{money(o.amount)} <span className="text-neutral-400">{String(o.status)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-neutral-500">
        {data.refunds.length
          ? data.refunds.map((r) => `${money(r.amount)} refunded on ${r.date} (${r.reason})`).join("; ")
          : "No refund history."}
      </div>
    </div>
  );
}

export function DraftReply({ data }: { data: { body: string; cited: { id: string; title: string }[] } }) {
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm leading-relaxed">{data.body}</p>
      <div className="text-xs text-neutral-500">Cited articles</div>
      {data.cited.length ? <KbChips matches={data.cited} /> : <div className="text-xs text-neutral-400">None cited.</div>}
    </div>
  );
}

export function Facts({ data }: { data: Row }) {
  const rows = Object.entries(data).filter(([k]) => k !== "action" && k !== "approvalId");
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-neutral-500">{k.replace(/_/g, " ")}</dt>
          <dd className="whitespace-pre-wrap">{Array.isArray(v) ? v.join(" → ") : k === "amount" ? money(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
