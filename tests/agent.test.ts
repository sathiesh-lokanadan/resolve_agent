import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_ROUNDS, MAX_TOOL_CALLS } from "@/lib/agent";
import { MAX_TRIES, TOOL_TIMEOUT_MS } from "@/lib/tools";
import * as kb from "@/lib/kb";
import { ProviderError } from "@/lib/providers/types";
import { call, route, run, say, ask } from "./helpers";

afterEach(() => vi.restoreAllMocks());

const search = (id = "s1") => call(id, "search_kb", { query: "refund policy" });
const kbHit = (id = "kb_005") => ({ id, title: "Refund policy", similarity: 0.9, text: "30 days" });
const refund = (id: string, order: string, amount: number) => call(id, "issue_refund", { order_id: order, amount, reason: "duplicate charge" });

describe("agent loop: limits", () => {
  it("stops after MAX_TOOL_CALLS and still produces an answer", async () => {
    const r = await run([ask(...Array.from({ length: MAX_TOOL_CALLS + 3 }, (_, i) => call(`c${i}`, "route_ticket", { category: "bug", urgency: 1, confidence: 1 }))), say("done")]);
    expect(r.ends).toHaveLength(MAX_TOOL_CALLS);
    expect(r.answer?.text).toContain("done");
  });
  it("stops after MAX_ROUNDS even if the model keeps asking for tools", async () => {
    const r = await run([ask(route)]);
    expect(r.rounds()).toBeLessThanOrEqual(MAX_ROUNDS);
    expect(r.answer?.text).toMatch(/round limit was reached/);
  });
  it("does not run tools on the last round", async () => {
    const r = await run([ask(route), ask(route), ask(route), ask(route), ask(route), ask(route), ask(route), ask(route), say("never")]);
    expect(r.rounds()).toBe(MAX_ROUNDS);
  });
});

describe("agent loop: rejections and retries", () => {
  it("returns the reason to the model and caps retries at MAX_TRIES", async () => {
    const bad = call("b", "route_ticket", { category: "nope" });
    const r = await run([ask(bad), ask({ ...bad, id: "b2" }), ask({ ...bad, id: "b3" }), ask({ ...bad, id: "b4" }), say("giving up")]);
    expect(r.statuses("route_ticket")).toEqual(["rejected", "rejected", "rejected", "rejected"]);
    expect(r.ends[MAX_TRIES].result.message).toMatch(/Stop retrying|rejected 3 times/);
    expect(r.seen[0][0].isError).toBe(true);
    expect(r.seen[0][0].content).toMatch(/category must be one of/);
  });
  it("rejects arguments that are not a JSON object", async () => {
    const r = await run([ask(call("x", "route_ticket", undefined), call("y", "search_kb", [1])), say("ok")]);
    expect(r.statuses("route_ticket")).toEqual(["rejected"]);
    expect(r.statuses("search_kb")).toEqual(["rejected"]);
  });
  it("answers an unknown tool name with an error, not a crash", async () => {
    const r = await run([ask(call("z", "drop_database", {})), say("ok")]);
    expect(r.statuses("drop_database")).toEqual(["error"]);
    expect(r.answer?.text).toBe("ok");
  });
});

describe("agent loop: human approval", () => {
  it("emits an approval event only for pending actions and never executes", async () => {
    const r = await run([ask(route, refund("f", "ord_1002", 49)), say("Proposed a refund; it awaits approval.")]);
    const approvals = r.events.filter((e) => e.type === "approval");
    expect(approvals).toHaveLength(1);
    expect(r.statuses("issue_refund")).toEqual(["pending_approval"]);
    expect(r.ends[1].result.message).toMatch(/Do not tell the customer/);
  });
  it("refuses a duplicate refund proposal for the same order", async () => {
    const r = await run([ask(refund("f1", "ord_1002", 49), refund("f2", "ord_1002", 49)), say("ok")]);
    expect(r.statuses("issue_refund")).toEqual(["pending_approval", "rejected"]);
    expect(r.ends[1].result.errors?.[0]).toMatch(/more than the refundable balance of 0/);
  });
});

describe("agent loop: failures", () => {
  it("turns a thrown tool error into an error envelope the model can read", async () => {
    vi.spyOn(kb, "searchKb").mockRejectedValue(new kb.KbError("Could not reach Supabase for embedding."));
    const r = await run([ask(route, search()), say("The KB was down; please escalate.")]);
    expect(r.statuses("search_kb")).toEqual(["error"]);
    expect(r.ends[1].result.message).toMatch(/do not state any policy from memory/);
  });
  it("times out a tool that hangs", async () => {
    vi.useFakeTimers();
    vi.spyOn(kb, "searchKb").mockReturnValue(new Promise(() => {}));
    const p = run([ask(search()), say("ok")]);
    await vi.advanceTimersByTimeAsync(TOOL_TIMEOUT_MS + 10);
    const r = await p;
    vi.useRealTimers();
    expect(r.statuses("search_kb")).toEqual(["error"]);
    expect(r.ends[0].result.message).toMatch(/timed out/);
  });
  it("keeps the tools that already ran when the provider fails mid-run", async () => {
    const r = await run([ask(route), new ProviderError("Could not reach the provider API.")]);
    expect(r.error).toBeInstanceOf(ProviderError);
    expect(r.statuses("route_ticket")).toEqual(["ok"]);
    expect(r.answer).toBeUndefined();
  });
  it("reports a refusal as an error event", async () => {
    const r = await run([{ text: "", calls: [], refused: "Claude declined to answer this request." }]);
    expect(r.errorEvent?.message).toMatch(/declined/);
  });
  it("reports an empty model answer instead of inventing one", async () => {
    const r = await run([say("   ")]);
    expect(r.answer).toBeUndefined();
    expect(r.errorEvent?.message).toMatch(/empty answer/);
  });
  it("stops quietly when the request is aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    const { runAgent } = await import("@/lib/agent");
    const events: unknown[] = [];
    await runAgent({ session: { label: "x", complete: async () => say("hi"), addToolResults() {} }, emit: (e) => events.push(e), signal: ac.signal });
    expect(events).toEqual([]);
  });
});

describe("output guardrails in the loop", () => {
  it("redacts PII in tool args and results, and in the final answer", async () => {
    const r = await run([
      ask(call("l", "lookup_customer", { email: "maya.okafor@brightside-bakery.example" })),
      say("Customer maya.okafor@brightside-bakery.example, phone +1 415 555 0134."),
    ]);
    const start = r.events.find((e) => e.type === "tool_start");
    expect(JSON.stringify(start)).not.toMatch(/@/);
    expect(JSON.stringify(r.ends[0].result)).not.toMatch(/@brightside|555 0134/);
    expect(r.answer?.text).not.toMatch(/@|555/);
  });
  it("removes a KB id the search never returned", async () => {
    vi.spyOn(kb, "searchKb").mockResolvedValue([kbHit()]);
    const r = await run([ask(search()), say("Refunds within 30 days (kb_005). Nonprofit discount is 40% (kb_099).")]);
    expect(r.answer?.text).toContain("kb_005");
    expect(r.answer?.text).not.toContain("(kb_099)");
    expect(r.answer?.text).toMatch(/Guardrail notice/);
  });
  it("allows ids shown in earlier turns", async () => {
    const r = await run([say("As before (kb_005).")], ["Refunds: see kb_005"]);
    expect(r.answer?.text).toBe("As before (kb_005).");
  });
  it("adds a notice when the answer claims a refund already happened", async () => {
    const r = await run([ask(refund("f", "ord_1002", 49)), say("I have refunded the duplicate charge.")]);
    expect(r.answer?.text).toMatch(/Nothing has been executed/);
  });
  it("warns when the KB failed and nothing was escalated", async () => {
    vi.spyOn(kb, "searchKb").mockRejectedValue(new kb.KbError("down"));
    const r = await run([ask(search()), say("Cannot confirm the policy.")]);
    expect(r.answer?.text).toMatch(/knowledge base was unavailable/);
  });
  it("rejects a draft that cites an article search_kb never returned", async () => {
    const draft = (id: string) => call(id, "draft_reply", { ticket_id: "T-1001", body: "Hello.", kb_article_ids: ["kb_001"] });
    vi.spyOn(kb, "searchKb").mockResolvedValue([kbHit("kb_001")]);
    const r = await run([ask(draft("d1")), ask(search()), ask(draft("d2")), say("ok")]);
    expect(r.statuses("draft_reply")).toEqual(["rejected", "pending_approval"]);
    expect(r.ends[0].result.errors?.[0]).toMatch(/not returned by search_kb/);
  });
});
