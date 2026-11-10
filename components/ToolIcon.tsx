import { Bug, FileText, Gauge, Library, Receipt, Send, UserRound, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  route_ticket: Gauge,
  search_kb: Library,
  lookup_customer: UserRound,
  draft_reply: Send,
  issue_refund: Receipt,
  create_bug_ticket: Bug,
  escalate_to_human: FileText,
};

export default function ToolIcon({ name, size = 15 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? FileText;
  return <Icon size={size} strokeWidth={1.75} />;
}
