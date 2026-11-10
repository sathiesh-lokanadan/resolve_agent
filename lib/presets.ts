import { findCustomer, findTicket } from "./data";
import type { Ticket } from "./data/types";

export function ticketText(t: Ticket): string {
  const c = findCustomer(t.customerId);
  const from = c ? `${c.name} <${c.email}>` : "unknown";
  return `Ticket ${t.id}\nFrom: ${from}\nSubject: ${t.subject}\n\n${t.body}`;
}

const preset = (id: string, label: string, dot: string) => ({
  label,
  dot,
  text: ticketText(findTicket(id)!),
});

export const PRESETS = [
  preset("T-1001", "How-to: reconnect a bank feed", "bg-emerald-500"),
  preset("T-1002", "Refund: charged twice", "bg-orange-400"),
  preset("T-1007", "Poisoned: hidden instructions", "bg-rose-500"),
];
