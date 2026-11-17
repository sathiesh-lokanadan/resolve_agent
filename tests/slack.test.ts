import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatSlackMessage, parseSlackUpdate, pickSendTool, postToSlack, type SlackUpdate } from "@/lib/slack";
import { SlackAuthProvider, SlackNotConnected } from "@/lib/slack-oauth";
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
  beforeEach(() => Object.assign(process.env, { SLACK_CLIENT_ID: "1.2", SLACK_CHANNEL_ID: "C1" }));
  afterEach(() => { process.env = { ...env }; });

  it("posts the text to the configured channel", async () => {
    const post = vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({ ok: true }) }] });
    expect(await postToSlack("hi", post)).toEqual({ ok: true });
    expect(post).toHaveBeenCalledWith("C1", "hi");
  });
  it("reports missing configuration without calling anything", async () => {
    delete process.env.SLACK_CHANNEL_ID;
    const post = vi.fn();
    expect(await postToSlack("hi", post)).toMatchObject({ ok: false, status: 503 });
    expect(post).not.toHaveBeenCalled();
  });
  it("surfaces Slack's own error", async () => {
    const post = vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({ ok: false, error: "channel_not_found" }) }] });
    expect(await postToSlack("hi", post)).toMatchObject({ ok: false, error: expect.stringContaining("channel_not_found") });
    const flagged = vi.fn().mockResolvedValue({ isError: true, content: [{ type: "text", text: "not_in_channel" }] });
    expect(await postToSlack("hi", flagged)).toMatchObject({ ok: false, error: expect.stringContaining("not_in_channel") });
  });
  it("tells the user to connect Slack when there is no valid token (409)", async () => {
    const r = await postToSlack("hi", vi.fn().mockRejectedValue(new SlackNotConnected()));
    expect(r).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("/api/slack/connect") });
  });
  it("turns other failures into a 502", async () => {
    expect(await postToSlack("hi", vi.fn().mockRejectedValue(new Error("boom")))).toMatchObject({ ok: false, status: 502 });
  });
});

describe("pickSendTool", () => {
  const t = (name: string, props: string[]) => ({ name, inputSchema: { properties: Object.fromEntries(props.map((p) => [p, {}])) } });
  it("finds the send tool and its argument names from the tool list", () => {
    const tools = [t("slack_search_public", ["query"]), t("slack_send_message_draft", ["channel_id", "message"]), t("slack_send_message", ["channel_id", "message"])];
    expect(pickSendTool(tools, undefined)).toEqual({ name: "slack_send_message", channelKey: "channel_id", textKey: "message" });
    expect(pickSendTool([t("slack_post_message", ["channel", "text"])], undefined)).toEqual({ name: "slack_post_message", channelKey: "channel", textKey: "text" });
  });
  it("returns null when nothing fits, and honours an override", () => {
    expect(pickSendTool([t("slack_search_public", ["query"])], undefined)).toBeNull();
    expect(pickSendTool([t("send_message", ["foo"])], undefined)).toBeNull();
    expect(pickSendTool([t("custom_tool", ["channel_id", "text"]), t("slack_send_message", ["channel_id", "message"])], "custom_tool")?.name).toBe("custom_tool");
  });
});

describe("SlackAuthProvider", () => {
  const store = (row: object = {}) => ({ load: vi.fn().mockResolvedValue(row), save: vi.fn().mockResolvedValue(undefined) });
  it("never starts a login during a normal post", () => {
    const p = new SlackAuthProvider(store(), "http://x/cb", false, { id: "1.2", secret: undefined });
    expect(() => p.redirectToAuthorization(new URL("https://slack.com/oauth"))).toThrow(SlackNotConnected);
  });
  it("keeps the URL, state and verifier of the connect flow in the store", async () => {
    const s = store({ code_verifier: "v1" });
    const p = new SlackAuthProvider(s, "http://x/cb", true, { id: "1.2", secret: undefined });
    p.redirectToAuthorization(new URL("https://slack.com/oauth"));
    expect(p.authorizationUrl?.host).toBe("slack.com");
    expect(await p.codeVerifier()).toBe("v1");
    await p.state();
    expect(s.save).toHaveBeenCalledWith({ state: expect.any(String) });
    expect(p.clientInformation()).toEqual({ client_id: "1.2" });
    expect(p.clientMetadata.token_endpoint_auth_method).toBe("none");
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
