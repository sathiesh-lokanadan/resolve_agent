import { describe, expect, it } from "vitest";
import { claimsCompletedAction, guardAnswer } from "@/lib/output-guard";
import { newToolContext } from "@/lib/tools";

describe("claimsCompletedAction", () => {
  it.each([
    "I have refunded the order.",
    "I've issued the refund.",
    "The refund has been processed.",
    "Your refund was issued yesterday.",
    "The reply has been sent to the customer.",
    "The customer has been refunded.",
  ])("flags: %s", (t) => expect(claimsCompletedAction(t)).toBe(true));

  it.each([
    "I proposed a refund; it awaits approval.",
    "The refund has not been issued yet.",
    "Nothing has been refunded.",
    "Once the refund has been approved, the customer is told.",
    "If the refund was issued twice, escalate.",
    "A draft reply is ready for approval.",
  ])("does not flag: %s", (t) => expect(claimsCompletedAction(t)).toBe(false));
});

describe("guardAnswer", () => {
  const known = (id: string) => id !== "kb_999";
  it("keeps allowed citations untouched", () => {
    const ctx = newToolContext(["kb_005"]);
    expect(guardAnswer("See kb_005.", ctx, known)).toEqual({ text: "See kb_005.", notes: [] });
  });
  it("removes citations that were not retrieved or do not exist", () => {
    const ctx = newToolContext(["kb_999"]);
    const r = guardAnswer("kb_001 and kb_999", ctx, known);
    expect(r.text).toContain("[unverified source] and [unverified source]");
    expect(r.notes).toHaveLength(1);
  });
});
