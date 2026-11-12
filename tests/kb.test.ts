import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BREAKER, KbError, resetBreaker, searchKb } from "@/lib/kb";

const embedOk = () => new Response(JSON.stringify({ embeddings: [[0.1, 0.2]] }));
const rowsOk = () => new Response(JSON.stringify([{ id: "kb_008", title: "T", body: "B", similarity: 0.91234 }]));

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
  resetBreaker();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("search_kb retrieval and failure handling", () => {
  it("returns matches ordered as the database returns them, rounded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(embedOk()).mockResolvedValueOnce(rowsOk()));
    expect(await searchKb("pdf")).toEqual([{ id: "kb_008", title: "T", similarity: 0.912, text: "B" }]);
  });
  it("says so when Supabase is not configured, and does not trip the breaker", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    await expect(searchKb("x")).rejects.toThrow(/not configured/);
    expect(BREAKER.failures).toBe(0);
  });
  it("retries one temporary failure", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(embedOk()).mockResolvedValueOnce(rowsOk());
    vi.stubGlobal("fetch", f);
    await expect(searchKb("x")).resolves.toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("does not retry a 401", async () => {
    const f = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    vi.stubGlobal("fetch", f);
    await expect(searchKb("x")).rejects.toThrow(/HTTP 401/);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("rejects a malformed embedding or search answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ embeddings: [] }))));
    await expect(searchKb("x")).rejects.toThrow(/unexpected answer/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(embedOk()).mockResolvedValueOnce(new Response(JSON.stringify({ not: "an array" }))));
    await expect(searchKb("x")).rejects.toThrow(/unexpected answer/);
  });
  it("opens the circuit after 3 outages, fails fast, then recovers after the cool-down", async () => {
    vi.useFakeTimers();
    const down = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", down);
    for (let i = 0; i < 3; i++) {
      const p = searchKb("x").catch((e) => e);
      await vi.advanceTimersByTimeAsync(1000);
      expect(await p).toBeInstanceOf(KbError);
    }
    const callsBefore = down.mock.calls.length;
    await expect(searchKb("x")).rejects.toThrow(/paused/);
    expect(down.mock.calls.length).toBe(callsBefore); // failed fast: no network call
    vi.advanceTimersByTime(31_000);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(embedOk()).mockResolvedValueOnce(rowsOk()));
    await expect(searchKb("x")).resolves.toHaveLength(1);
    expect(BREAKER.failures).toBe(0);
  });
});
