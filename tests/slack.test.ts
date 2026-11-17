import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatSlackMessage, parseSlackUpdate, postToSlack, type SlackUpdate } from "@/lib/slack";
import { buildSlackPayload } from "@/lib/slack-client";
import { newToolContext, runTool } from "@/lib/tools";
import type { ChatMessage } from "@/lib/types";

const base = {
  query: "I was charged twice, my email is maya@example.com",
  summary: "## Summary\n**Duplicate charge** confirmed. Refund proposed.",
  decision: "approved",
  refund: { orderId: "ORD-1", customer: "Maya Chen", amount: 49.5, reason: "duplicate charge" },
  bugs: [{ id: "BUG-1001", title: "Double charge on retry", steps: ["Pay", "Retry"], severity: "high", status: "approved" }],
};
const update = () => parseSlackUpdate(base) as SlackUpdate;

describe("parseSlackUpdate", () => {
  it("accepts a refund decision", () => expect(typeof update()).toBe("object"));
  it("requires a refund, so how-tos and other actions never post", () => {
    expect(parseSlackUpdate({ ...base, refund: undefined })).toMatch(/refund/i);
  });
  it("requires a valid decision and a reason when rejected", () => {
    expect(parseSlackUpdate({ ...base, decision: "pending" })).toMatch(/decision/);
    expect(parseSlackUpdate({ ...base, decision: "rejected" })).toMatch(/reason/);
  });
  it("rejects bad amounts and drops malformed bugs", () => {
    expect(parseSlackUpdate({ ...base, refund: { ...base.refund, amount: -1 } })).toMatch(/amount/);
    const u = parseSlackUpdate({ ...base, bugs: [{ id: "x", status: "approved" }, base.bugs[0]] }) as SlackUpdate;
    expect(u.bugs.map((b) => b.id)).toEqual(["BUG-1001"]);
  });
});

describe("formatSlackMessage", () => {
  it("contains the query, summary, decision, refund and bug, with PII redacted", () => {
    const t = formatSlackMessage(update(), "Sam Lee");
    expect(t).toContain("Refund approved");
    expect(t).toContain("Customer query");
    expect(t).toContain("[redacted email]");
    expect(t).not.toContain("maya@example.com");
    expect(t).toContain("*Duplicate charge*");
    expect(t).toContain("Approved by Sam Lee");
    expect(t).toContain("$49.50 USD");
    expect(t).toContain("BUG-1001");
    expect(t).toContain("Double charge on retry");
  });
  it("shows a rejection with the reason and escapes Slack markup", () => {
    const u = parseSlackUpdate({ ...base, decision: "rejected", reason: "outside <!channel> policy", bugs: [] }) as SlackUpdate;
    const t = formatSlackMessage(u, "Sam Lee");
    expect(t).toContain("Refund rejected");
    expect(t).toContain("not processed");
    expect(t).toContain("&lt;!channel&gt;");
    expect(t).not.toContain("<!channel>");
    expect(t).not.toContain("BUG-");
  });
});

describe("postToSlack", () => {
  const env = { ...process.env };
  beforeEach(() => Object.assign(process.env, { SLACK_BOT_TOKEN: "xoxb-secret-token", SLACK_TEAM_ID: "T1", SLACK_CHANNEL_ID: "C1" }));
  afterEach(() => { process.env = { ...env }; });

  it("calls slack_post_message with the channel and text", async () => {
    const call = vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({ ok: true }) }] });
    expect(await postToSlack("hi", call)).toEqual({ ok: true });
    expect(call).toHaveBeenCalledWith("slack_post_message", { channel_id: "C1", text: "hi" });
  });
  it("reports missing configuration without calling anything", async () => {
    delete process.env.SLACK_CHANNEL_ID;
    const call = vi.fn();
    const r = await postToSlack("hi", call);
    expect(r).toMatchObject({ ok: false, status: 503 });
    expect(call).not.toHaveBeenCalled();
  });
  it("surfaces Slack's own error and never leaks the token", async () => {
    const slackErr = vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({ ok: false, error: "channel_not_found" }) }] });
    expect(await postToSlack("hi", slackErr)).toMatchObject({ ok: false, error: expect.stringContaining("channel_not_found") });
    const boom = vi.fn().mockRejectedValue(new Error("spawn failed xoxb-secret-token"));
    const r = await postToSlack("hi", boom);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("xoxb-secret-token");
  });
});

describe("buildSlackPayload", () => {
  const msgs = (name: string): ChatMessage[] => [
    { id: "u", role: "user", text: "Refund please", steps: [], calls: [], status: "done" },
    {
      id: "a", role: "assistant", text: "Summary here", steps: [], status: "done",
      calls: [
        { id: "r", name, args: {}, result: { tool: name, status: "pending_approval", source: "", fetchedAt: "", fixtureId: null, note: "", data: { order_id: "ORD-1", amount: 10, reason: "dup", customer: "Maya" } }, approval: { state: "pending" } },
        { id: "b", name: "create_bug_ticket", args: {}, result: { tool: "create_bug_ticket", status: "pending_approval", source: "", fetchedAt: "", fixtureId: null, note: "", data: { bug_id: "BUG-1002", title: "t", steps: ["s"], severity: "low" } }, approval: { state: "approved" } },
      ],
    },
  ];
  it("builds from the refund, the user's query and the agent summary, including bugs", () => {
    const p = buildSlackPayload(msgs("issue_refund"), "a", "r", { state: "approved" })!;
    expect(p).toMatchObject({ query: "Refund please", summary: "Summary here", decision: "approved", refund: { orderId: "ORD-1", amount: 10 } });
    expect(p.bugs).toEqual([{ id: "BUG-1002", title: "t", steps: ["s"], severity: "low", status: "approved" }]);
  });
  it("returns null for anything that is not a refund decision", () => {
    expect(buildSlackPayload(msgs("draft_reply"), "a", "r", { state: "approved" })).toBeNull();
    expect(buildSlackPayload(msgs("issue_refund"), "a", "b", { state: "approved" })).toBeNull();
    expect(buildSlackPayload(msgs("issue_refund"), "a", "r", { state: "pending" })).toBeNull();
  });
});

describe("bug ids", () => {
  it("gives each proposed bug a BUG- id", async () => {
    const r = await runTool("create_bug_ticket", { title: "PDF blank", steps: ["open", "export"], severity: "high" }, newToolContext());
    expect((r.data as { bug_id: string }).bug_id).toMatch(/^BUG-\d{4}$/);
  });
});
