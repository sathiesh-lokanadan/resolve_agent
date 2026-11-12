import { afterEach, describe, expect, it, vi } from "vitest";
import { openaiSession } from "@/lib/providers/openai";
import { googleSession } from "@/lib/providers/google";
import { describeError } from "@/lib/providers";
import { ProviderError } from "@/lib/providers/types";

afterEach(() => vi.unstubAllGlobals());
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const opts = { apiKey: "k", model: "m", turns: [{ role: "user" as const, content: "hi" }] };

describe("model output handling", () => {
  it("OpenAI: malformed tool-call JSON becomes undefined input (the tool then rejects it)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ choices: [{ message: { content: null, tool_calls: [{ id: "1", type: "function", function: { name: "route_ticket", arguments: "{not json" } }] } }] })));
    const out = await openaiSession(opts).complete(true);
    expect(out.calls).toEqual([{ id: "1", name: "route_ticket", input: undefined }]);
  });
  it("OpenAI: empty choices is an error; a refusal is reported", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ choices: [] })));
    await expect(openaiSession(opts).complete(true)).rejects.toThrow(/empty answer/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ choices: [{ message: { content: null, refusal: "no" } }] })));
    expect((await openaiSession(opts).complete(true)).refused).toMatch(/declined/);
  });
  it("OpenAI: running out of output budget is an error, not a blank answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ choices: [{ finish_reason: "length", message: { content: "" } }] })));
    await expect(openaiSession(opts).complete(true)).rejects.toThrow(/output budget/);
  });
  it("Gemini: a blocked prompt is reported as a refusal with the reason", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ promptFeedback: { blockReason: "SAFETY" } })));
    expect((await googleSession(opts).complete(true)).refused).toMatch(/SAFETY/);
  });
});

describe("describeError", () => {
  it("maps provider statuses to friendly text", () => {
    expect(describeError(new ProviderError("x", 401), "openai", "sk-longkey-0001")).toMatch(/rejected the API key/);
    expect(describeError(new ProviderError("x", 429), "google", "sk-longkey-0001")).toMatch(/rate limit/i);
  });
  it("scrubs the key from anything passed through", () => {
    expect(describeError(new ProviderError("failed for key sk-abc"), "openai", "sk-abc")).toBe("failed for key [key]");
  });
});
