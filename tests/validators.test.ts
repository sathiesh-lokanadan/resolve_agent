import { describe, expect, it } from "vitest";
import {
  checkBug, checkDraft, checkEscalate, checkLookup, checkRefundArgs, checkRefundRules, checkRoute, checkSearch,
} from "@/lib/validators";
import { findOrder } from "@/lib/data";

const ok = (r: { ok: boolean }) => r.ok;

describe("argument validators", () => {
  it("route_ticket: category, urgency 1-4, confidence 0-1", () => {
    expect(ok(checkRoute({ category: "billing", urgency: 2, confidence: 0.5 }))).toBe(true);
    expect(ok(checkRoute({ category: "weather", urgency: 2, confidence: 0.5 }))).toBe(false);
    expect(ok(checkRoute({ category: "bug", urgency: 5, confidence: 0.5 }))).toBe(false);
    expect(ok(checkRoute({ category: "bug", urgency: 1.5, confidence: 0.5 }))).toBe(false);
    expect(ok(checkRoute({ category: "bug", urgency: 1, confidence: 1.2 }))).toBe(false);
    expect(ok(checkRoute({}))).toBe(false);
  });

  it("search_kb and lookup_customer need a usable argument", () => {
    expect(ok(checkSearch({ query: "  " }))).toBe(false);
    expect(ok(checkSearch({ query: "x".repeat(301) }))).toBe(false);
    expect(ok(checkSearch({ query: "bank feed" }))).toBe(true);
    expect(ok(checkLookup({}))).toBe(false);
    expect(ok(checkLookup({ email: "a@b.example" }))).toBe(true);
  });

  it("draft_reply: unknown KB ids, PII and length are rejected", () => {
    const base = { ticket_id: "T-1001", body: "Hello, here is how.", kb_article_ids: ["kb_001"] };
    expect(ok(checkDraft(base))).toBe(true);
    expect(ok(checkDraft({ ...base, kb_article_ids: ["kb_999"] }))).toBe(false);
    expect(ok(checkDraft({ ...base, body: "Write to me at maya@x.example" }))).toBe(false);
    expect(ok(checkDraft({ ...base, body: "Card 4242 4242 4242 4242" }))).toBe(false);
    expect(ok(checkDraft({ ...base, body: "word ".repeat(121) }))).toBe(false);
    expect(ok(checkDraft({ ...base, body: "word ".repeat(120) }))).toBe(true);
    expect(ok(checkDraft({ ...base, kb_article_ids: "kb_001" }))).toBe(false);
  });

  it("issue_refund arguments: positive amount with 2 decimals, reason without PII", () => {
    const base = { order_id: "ord_1002", amount: 49, reason: "duplicate" };
    expect(ok(checkRefundArgs(base))).toBe(true);
    for (const amount of [0, -5, 10.123, "49", NaN]) expect(ok(checkRefundArgs({ ...base, amount }))).toBe(false);
    expect(ok(checkRefundArgs({ ...base, reason: "call 415 555 0134" }))).toBe(false);
  });

  it("bug and escalation payloads", () => {
    expect(ok(checkBug({ title: "PDF blank", steps: ["open", "export"], severity: "high" }))).toBe(true);
    expect(ok(checkBug({ title: "PDF blank", steps: [], severity: "high" }))).toBe(false);
    expect(ok(checkBug({ title: "PDF blank", steps: Array(13).fill("x"), severity: "high" }))).toBe(false);
    expect(ok(checkBug({ title: "PDF blank", steps: ["a@b.example"], severity: "high" }))).toBe(false);
    expect(ok(checkBug({ title: "t", steps: ["s"], severity: "urgent" }))).toBe(false);
    expect(ok(checkEscalate({ reason: "legal", summary: "threatens to sue" }))).toBe(true);
    expect(ok(checkEscalate({ reason: "legal", summary: "email me a@b.example" }))).toBe(false);
  });
});

describe("refund rules (window, balance, cap)", () => {
  const order = (id: string) => findOrder(id)!.order;

  it("accepts an order inside the 30-day window", () => {
    expect(checkRefundRules(order("ord_1002"), 49, 0)).toEqual({ kind: "ok" });
  });
  it("rejects an order outside the window", () => {
    const v = checkRefundRules(order("ord_1003"), 49, 0);
    expect(v.kind).toBe("reject");
  });
  it("rejects more than the refundable balance", () => {
    expect(checkRefundRules(order("ord_1002"), 49.01, 0).kind).toBe("reject");
    expect(checkRefundRules(order("ord_1002"), 30, 20).kind).toBe("reject");
  });
  it("sends amounts over the 200 USD cap to a human", () => {
    expect(checkRefundRules(order("ord_2001"), 480, 0).kind).toBe("needs_human");
    expect(checkRefundRules(order("ord_2001"), 200, 0).kind).toBe("ok");
    expect(checkRefundRules(order("ord_2001"), 200.01, 0).kind).toBe("needs_human");
    expect(checkRefundRules(order("ord_2001"), 100, 0, 100).kind).toBe("ok");
    expect(checkRefundRules(order("ord_2001"), 100, 0, 100.01).kind).toBe("needs_human");
  });
});
