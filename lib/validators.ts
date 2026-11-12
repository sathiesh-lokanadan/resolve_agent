import { CATEGORIES, SEVERITIES } from "./types";
import { findPii } from "./redact";
import { findArticle, ageInDays } from "./data";
import type { Order } from "./data/types";

export const REFUND_WINDOW_DAYS = 30;
export const REFUND_CAP_USD = 200;
export const MAX_REPLY_WORDS = 120;

type Input = Record<string, unknown>;
export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const str = (v: unknown, max = 2000) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null;

function collect<T>(errors: string[], value: T): Checked<T> {
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

function piiErrors(label: string, text: string): string[] {
  const found = findPii(text);
  return found.length ? [`${label} contains an unredacted ${found.join(" and ")}; remove it.`] : [];
}

export function checkRoute(i: Input) {
  const errors: string[] = [];
  const category = (CATEGORIES as readonly string[]).includes(i.category as string)
    ? (i.category as string)
    : (errors.push(`category must be one of ${CATEGORIES.join(", ")}.`), "");
  const urgency = i.urgency;
  if (!Number.isInteger(urgency) || (urgency as number) < 1 || (urgency as number) > 4)
    errors.push("urgency must be an integer from 1 to 4.");
  const confidence = i.confidence;
  if (typeof confidence !== "number" || !(confidence >= 0 && confidence <= 1))
    errors.push("confidence must be a number from 0 to 1.");
  return collect(errors, { category, urgency: urgency as number, confidence: confidence as number });
}

export function checkSearch(i: Input) {
  const query = str(i.query, 300);
  return collect(query ? [] : ["query must be a non-empty string (max 300 characters)."], { query: query ?? "" });
}

export function checkLookup(i: Input) {
  const customerId = str(i.customer_id, 40) ?? undefined;
  const email = str(i.email, 200) ?? undefined;
  return collect(customerId || email ? [] : ["Provide customer_id or email."], { customerId, email });
}

export function checkDraft(i: Input) {
  const errors: string[] = [];
  const ticketId = str(i.ticket_id, 40);
  const body = str(i.body, 3000);
  if (!ticketId) errors.push("ticket_id is required.");
  if (!body) errors.push("body is required.");
  const ids = Array.isArray(i.kb_article_ids) ? i.kb_article_ids : null;
  if (!ids || !ids.every((x) => typeof x === "string")) errors.push("kb_article_ids must be an array of strings.");
  const kbIds = (ids ?? []) as string[];
  const unknown = kbIds.filter((id) => !findArticle(id));
  if (unknown.length) errors.push(`Unknown KB article id(s): ${unknown.join(", ")}. Cite only ids returned by search_kb.`);
  if (body) {
    errors.push(...piiErrors("body", body));
    const words = body.split(/\s+/).length;
    if (words > MAX_REPLY_WORDS) errors.push(`body has ${words} words; the limit is ${MAX_REPLY_WORDS}.`);
  }
  return collect(errors, { ticketId: ticketId ?? "", body: body ?? "", kbIds });
}

export function checkRefundArgs(i: Input) {
  const errors: string[] = [];
  const orderId = str(i.order_id, 40);
  const reason = str(i.reason, 500);
  const amount = i.amount;
  if (!orderId) errors.push("order_id is required.");
  if (!reason) errors.push("reason is required.");
  if (typeof amount !== "number" || !(amount > 0) || Math.round(amount * 100) / 100 !== amount)
    errors.push("amount must be a positive number with at most 2 decimals.");
  if (reason) errors.push(...piiErrors("reason", reason));
  return collect(errors, { orderId: orderId ?? "", amount: amount as number, reason: reason ?? "" });
}

export type RefundVerdict =
  | { kind: "ok" }
  | { kind: "reject"; errors: string[] }
  | { kind: "needs_human"; message: string };

/** The refund rules, in plain code: window, order total, then the cap. */
export function checkRefundRules(order: Order, amount: number, alreadyRefunded: number, proposedThisRequest = 0): RefundVerdict {
  const age = ageInDays(order.date);
  const errors: string[] = [];
  if (age > REFUND_WINDOW_DAYS)
    errors.push(`Order ${order.id} is ${age} days old; refunds are only allowed within ${REFUND_WINDOW_DAYS} days.`);
  const remaining = Math.round((order.amount - alreadyRefunded) * 100) / 100;
  if (amount > remaining)
    errors.push(`Amount ${amount} is more than the refundable balance of ${remaining} on ${order.id}.`);
  if (errors.length) return { kind: "reject", errors };
  // The cap counts refunds already proposed in this request, so splitting one big refund into small ones does not get past it.
  const total = Math.round((amount + proposedThisRequest) * 100) / 100;
  if (total > REFUND_CAP_USD)
    return {
      kind: "needs_human",
      message: `Amount ${amount}${proposedThisRequest ? ` plus ${proposedThisRequest} already proposed` : ""} is over the ${REFUND_CAP_USD} USD cap. Do not retry; call escalate_to_human.`,
    };
  return { kind: "ok" };
}

export function checkBug(i: Input) {
  const errors: string[] = [];
  const title = str(i.title, 140);
  if (!title) errors.push("title is required (max 140 characters).");
  const steps = Array.isArray(i.steps) ? i.steps : null;
  if (!steps || !steps.length || steps.length > 12 || !steps.every((s) => typeof s === "string" && s.trim()))
    errors.push("steps must be an array of 1 to 12 non-empty strings.");
  const severity = (SEVERITIES as readonly string[]).includes(i.severity as string) ? (i.severity as string) : "";
  if (!severity) errors.push(`severity must be one of ${SEVERITIES.join(", ")}.`);
  const list = (steps ?? []) as string[];
  errors.push(...piiErrors("title or steps", `${title ?? ""} ${list.join(" ")}`));
  return collect(errors, { title: title ?? "", steps: list, severity });
}

export function checkEscalate(i: Input) {
  const errors: string[] = [];
  const reason = str(i.reason, 500);
  const summary = str(i.summary, 2000);
  if (!reason) errors.push("reason is required.");
  if (!summary) errors.push("summary is required.");
  errors.push(...piiErrors("reason or summary", `${reason ?? ""} ${summary ?? ""}`));
  return collect(errors, { reason: reason ?? "", summary: summary ?? "" });
}
