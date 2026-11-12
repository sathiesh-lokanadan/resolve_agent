import { describe, expect, it } from "vitest";
import { MAX_TURNS, MAX_TURN_CHARS, parseBody } from "@/lib/request";

const turn = (content: string, role = "user") => ({ role, content });
const base = { provider: "anthropic", model: "claude-sonnet-5-5", messages: [turn("hi")] };

describe("request guardrails", () => {
  it("accepts a valid request and defaults the provider", () => {
    expect(parseBody(base)).toMatchObject({ provider: "anthropic", turns: [{ role: "user", content: "hi" }] });
    expect(parseBody({ ...base, provider: undefined })).toMatchObject({ provider: "anthropic" });
  });
  it.each([
    ["null body", null],
    ["unknown provider", { ...base, provider: "evil" }],
    ["model with a slash", { ...base, model: "../../etc" }],
    ["model with spaces", { ...base, model: "a b" }],
    ["non-string model", { ...base, model: 5 }],
    ["no messages", { ...base, messages: [] }],
    ["too many turns", { ...base, messages: Array(MAX_TURNS + 1).fill(turn("x")) }],
    ["bad role", { ...base, messages: [turn("x", "system")] }],
    ["non-string content", { ...base, messages: [{ role: "user", content: 5 }] }],
    ["turn too long", { ...base, messages: [turn("x".repeat(MAX_TURN_CHARS + 1))] }],
    ["conversation too long", { ...base, messages: Array(8).fill(turn("x".repeat(MAX_TURN_CHARS))).map((t, i) => ({ ...t, role: i % 2 ? "assistant" : "user" })).concat(turn("y")) }],
    ["last turn not from user", { ...base, messages: [turn("x"), turn("y", "assistant")] }],
    ["blank last message", { ...base, messages: [turn("   ")] }],
  ])("rejects %s", (_n, body) => {
    expect(typeof parseBody(body)).toBe("string");
  });
  it("strips control characters but keeps newlines and tabs", () => {
    const r = parseBody({ ...base, messages: [turn("a\u0000b\u001bc\nd\te")] });
    expect(r).toMatchObject({ turns: [{ content: "abc\nd\te" }] });
  });
});
