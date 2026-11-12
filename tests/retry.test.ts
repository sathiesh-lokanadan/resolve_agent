import { afterEach, describe, expect, it, vi } from "vitest";
import { withRetry } from "@/lib/retry";
import { postJson, retryAfterMs } from "@/lib/providers/http";
import { ProviderError } from "@/lib/providers/types";

const noWait = vi.fn(async () => {});
afterEach(() => {
  vi.unstubAllGlobals();
  noWait.mockClear();
});

describe("withRetry", () => {
  it("backs off exponentially and stops at the attempt limit", async () => {
    const waits: number[] = [];
    const fn = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(withRetry(fn, { attempts: 4, baseMs: 100, shouldRetry: () => true, sleep: async (ms) => void waits.push(ms) })).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(4);
    expect(waits).toEqual([100, 200, 400]);
  });
  it("does not retry when shouldRetry says no", async () => {
    const fn = vi.fn(async () => {
      throw new Error("fatal");
    });
    await expect(withRetry(fn, { shouldRetry: () => false, sleep: noWait })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("does not retry after an abort", async () => {
    const ac = new AbortController();
    const fn = vi.fn(async () => {
      ac.abort();
      throw new Error("x");
    });
    await expect(withRetry(fn, { shouldRetry: () => true, signal: ac.signal, sleep: noWait })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });

describe("postJson (provider calls)", () => {
  it("retries a 429 and honours Retry-After", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(reply(429, { error: { message: "slow down" } }, { "retry-after": "2" }))
      .mockResolvedValueOnce(reply(200, { ok: true }));
    vi.stubGlobal("fetch", f);
    const waits: number[] = [];
    await expect(postJson("http://x", {}, {}, undefined, async (ms) => void waits.push(ms))).resolves.toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([2000]);
  });
  it("retries a 503 and a dropped connection, then gives up after 3 attempts", async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(503, "down")).mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(reply(500, "still down"));
    vi.stubGlobal("fetch", f);
    await expect(postJson("http://x", {}, {}, undefined, noWait)).rejects.toMatchObject({ status: 500 });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it.each([400, 401, 403, 404])("does not retry a %i", async (status) => {
    const f = vi.fn().mockResolvedValue(reply(status, { error: { message: "no" } }));
    vi.stubGlobal("fetch", f);
    await expect(postJson("http://x", {}, {}, undefined, noWait)).rejects.toBeInstanceOf(ProviderError);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("turns a non-JSON 200 into a clear error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, "<html>oops</html>")));
    await expect(postJson("http://x", {}, {}, undefined, noWait)).rejects.toThrow(/not valid JSON/);
  });
  it("parses Retry-After in seconds and caps it", () => {
    expect(retryAfterMs("3")).toBe(3000);
    expect(retryAfterMs("999")).toBe(8000);
    expect(retryAfterMs(null)).toBe(0);
    expect(retryAfterMs("soon")).toBe(0);
  });
});
