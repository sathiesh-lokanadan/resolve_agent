import { beforeEach, describe, expect, it, vi } from "vitest";
import { call, say, scripted, ask } from "./helpers";
import { ProviderError } from "@/lib/providers/types";

const state = vi.hoisted(() => ({ make: null as null | (() => unknown) }));
vi.mock("@/lib/providers", async (orig) => ({
  ...(await orig<typeof import("@/lib/providers")>()),
  createSession: () => state.make!(),
}));

const { POST } = await import("@/app/api/resolve/route");

const post = (body: unknown, headers: Record<string, string> = { "x-api-key": "sk-secret-key-123456789" }) =>
  POST(new Request("http://localhost/api/resolve", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
const valid = { provider: "anthropic", model: "claude-sonnet-5-5", messages: [{ role: "user", content: "Ticket T-1001 how do I reconnect my bank feed?" }] };
const events = async (res: Response) => (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));

beforeEach(() => {
  state.make = () => scripted([say("hello")]).session;
});

describe("POST /api/resolve", () => {
  it("401 without an API key", async () => {
    const res = await post(valid, {});
    expect(res.status).toBe(401);
  });
  it("400 for invalid JSON and invalid bodies, with a request id", async () => {
    const bad = await post("{nope");
    expect(bad.status).toBe(400);
    expect(bad.headers.get("x-request-id")).toBeTruthy();
    expect((await post({ ...valid, model: "../x" })).status).toBe(400);
  });
  it("413 for an oversized body", async () => {
    expect((await post("x".repeat(250_000))).status).toBe(413);
  });
  it("streams events and always ends with done", async () => {
    const res = await post(valid);
    expect(res.headers.get("content-type")).toContain("ndjson");
    const ev = await events(res);
    expect(ev.map((e) => e.type)).toEqual(["step", "answer", "done"]);
  });
  it("turns a provider failure into an error event and still ends with done, scrubbing the key", async () => {
    state.make = () => scripted([ask(call("a", "route_ticket", { category: "bug", urgency: 1, confidence: 1 })), new ProviderError("bad key sk-secret-key-123456789")]).session;
    const ev = await events(await post(valid));
    expect(ev.at(-1)).toEqual({ type: "done" });
    const err = ev.find((e) => e.type === "error");
    expect(err.message).not.toContain("sk-secret-key-123456789");
    expect(err.message).toContain("[key]");
    expect(ev.some((e) => e.type === "tool_end")).toBe(true); // partial work is kept
  });
  it("does not leak the text of unexpected errors", async () => {
    state.make = () => scripted([new TypeError("Cannot read properties of undefined (reading 'secretInternal')")]).session;
    const err = (await events(await post(valid))).find((e) => e.type === "error");
    expect(err.message).toBe("Unexpected server error. Try again.");
  });
});
