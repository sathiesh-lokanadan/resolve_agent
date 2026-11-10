import { Gauge, Tag } from "lucide-react";

const URGENCY = ["", "Low", "Normal", "High", "Critical"];
const TONE = ["", "bg-emerald-50 text-emerald-800", "bg-sky-50 text-sky-800", "bg-orange-50 text-orange-800", "bg-rose-50 text-rose-800"];

export interface Routing {
  category: string;
  urgency: number;
  confidence: number;
}

export default function RoutingBadge({ category, urgency, confidence }: Routing) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 font-medium">
        <Tag size={12} /> {category.replace("_", " ")}
      </span>
      <span className={`rounded-full px-2.5 py-1 font-medium ${TONE[urgency] ?? ""}`}>
        Urgency {urgency} · {URGENCY[urgency]}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 font-medium">
        <Gauge size={12} /> {Math.round(confidence * 100)}% confident
      </span>
    </div>
  );
}
