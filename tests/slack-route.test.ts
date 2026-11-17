import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/slack", async (orig) => ({ ...(await orig<typeof import("@/lib/slack")>()), postToSlack: post }));
process.env.RESOLVE_ACCESS_TOKEN = "test-token";
const { createSession } = await import("@/lib/auth");
const { POST } = await import("@/app/api/slack/notify/route");

const body = { query: "q", summary: "s", decision: "approved", refund: { orderId: "ORD-1", customer: "Maya", amount: 5, reason: "dup" }, bugs: [] };
const send = (b: unknown, cookie: string | null = `resolve_session=${createSession("Sam Lee")}`) =>
  POST(new Request("http://localhost/api/slack/notify", { method: "POST", headers: cookie ? { cookie } : {}, body: JSON.stringify(b) }));

beforeEach(() => post.mockReset().mockResolvedValue({ ok: true }));

describe("POST /api/slack/notify", () => {
  it("401 when signed out", async () => {
    expect((await send(body, null)).status).toBe(401);
    expect(post).not.toHaveBeenCalled();
  });
  it("400 for a non-refund payload", async () => {
    expect((await send({ ...body, refund: null })).status).toBe(400);
    expect(post).not.toHaveBeenCalled();
  });
  it("posts, naming the signed-in user as the decider", async () => {
    expect((await send(body)).status).toBe(200);
    expect(post.mock.calls[0][0]).toContain("Approved by Sam Lee");
  });
  it("passes Slack failures to the browser", async () => {
    post.mockResolvedValue({ ok: false, status: 502, error: "Slack rejected the post: channel_not_found" });
    const res = await send(body);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("channel_not_found");
  });
});
