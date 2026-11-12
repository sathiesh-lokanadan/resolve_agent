import type { ToolContext } from "./tools";

/**
 * Output guardrails: checks on the final answer, in plain code, before it reaches the screen.
 * They never rewrite facts. They remove citations that do not exist and add a visible warning.
 */
export interface GuardResult {
  text: string;
  notes: string[];
}

const KB_ID = /\bkb_\d{3}\b/g;
const NEGATION_BEFORE = /\b(not|no|nothing|never|until|once|before|if|when|after|unless|won't|cannot|can't)\b[^.\n]*$/i;

/** Phrases that say an action already happened. Nothing is executed here, so these are false. */
const DONE_CLAIMS: RegExp[] = [
  /\b(refund|reimbursement)\b[^.\n]{0,40}\b(has|have|was|were)\s+(already\s+|now\s+|successfully\s+)?(been\s+)?(issued|processed|completed|sent|approved)\b/gi,
  /\b(has|have|had)\s+(already\s+|now\s+|successfully\s+)?(been\s+)?refunded\b/gi,
  /\bi(?:'|’)?ve\s+(already\s+|now\s+)?(refunded|issued|sent|escalated|processed)\b|\bi\s+have\s+(already\s+|now\s+)?(refunded|issued|sent|escalated|processed)\b/gi,
  /\b(reply|email|message)\s+(has|have|was)\s+(already\s+|now\s+)?(been\s+)?sent\b/gi,
];

export function claimsCompletedAction(text: string): boolean {
  return DONE_CLAIMS.some((re) =>
    [...text.matchAll(re)].some((m) => !NEGATION_BEFORE.test(text.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0))),
  );
}

export function guardAnswer(text: string, ctx: ToolContext, knownArticleIds: (id: string) => boolean): GuardResult {
  const notes: string[] = [];
  let out = text;

  // 1. Citations: an id the model never saw (or that does not exist) is removed.
  const bad = [...new Set(out.match(KB_ID) ?? [])].filter((id) => !ctx.allowedKb.has(id) || !knownArticleIds(id));
  if (bad.length) {
    out = out.replace(KB_ID, (id) => (bad.includes(id) ? "[unverified source]" : id));
    notes.push(`Removed citation(s) ${bad.join(", ")}: not returned by the knowledge-base search in this conversation.`);
  }

  // 2. Nothing is executed by the model; say so if the answer claims otherwise.
  if (claimsCompletedAction(out))
    notes.push("The answer above says an action was completed. Nothing has been executed; every action waits for human approval.");

  // 3. Knowledge base outage: policy statements are unverified.
  if (ctx.kbFailed && !ctx.proposed.has("escalate_to_human"))
    notes.push("The knowledge base was unavailable during this request, so any policy statement is unverified. Retry, or escalate to a human.");

  if (notes.length) out += `\n\n> **Guardrail notice**\n${notes.map((n) => `> - ${n}`).join("\n")}`;
  return { text: out, notes };
}
