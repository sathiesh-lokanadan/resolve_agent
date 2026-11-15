import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanName, createSession, readSession, tokenMatches } from "@/lib/auth";

const cookie = (v: string) => `theme=dark; resolve_session=${v}`;
beforeEach(() => void (process.env.RESOLVE_ACCESS_TOKEN = "secret-token"));
afterEach(() => void delete process.env.RESOLVE_ACCESS_TOKEN);

describe("token", () => {
  it("accepts only the configured token", () => {
    expect(tokenMatches("secret-token")).toBe(true);
    expect(tokenMatches("  secret-token ")).toBe(true);
    expect(tokenMatches("wrong")).toBe(false);
    expect(tokenMatches("")).toBe(false);
    expect(tokenMatches(undefined)).toBe(false);
  });
  it("fails closed when no token is configured", () => {
    delete process.env.RESOLVE_ACCESS_TOKEN;
    expect(tokenMatches("")).toBe(false);
    expect(readSession(cookie("a.b"))).toBeNull();
  });
});

describe("full name", () => {
  it("accepts real names and tidies spacing", () => {
    expect(cleanName("  Maya   Okafor ")).toBe("Maya Okafor");
    expect(cleanName("Mary-Jane O'Neil")).toBe("Mary-Jane O'Neil");
    expect(cleanName("José Núñez")).toBe("José Núñez");
  });
  it("rejects emails, user ids, single words and markup", () => {
    for (const bad of ["maya@x.com", "user_123", "Maya", "Maya 2", "<b>Maya</b> Okafor", "", "a b c d e f", 5, null])
      expect(cleanName(bad)).toBeNull();
  });
});

describe("session cookie", () => {
  it("round-trips the name", () => expect(readSession(cookie(createSession("Maya Okafor")))).toBe("Maya Okafor"));
  it("rejects a tampered payload or signature", () => {
    const [p, s] = createSession("Maya Okafor").split(".");
    const forged = Buffer.from(JSON.stringify({ n: "Admin User", e: Date.now() + 1e6 })).toString("base64url");
    expect(readSession(cookie(`${forged}.${s}`))).toBeNull();
    expect(readSession(cookie(`${p}.${s}x`))).toBeNull();
    expect(readSession(cookie("garbage"))).toBeNull();
  });
  it("expires, and dies when the token changes", () => {
    const v = createSession("Maya Okafor", 0);
    expect(readSession(cookie(v), 9 * 3600 * 1000)).toBeNull();
    process.env.RESOLVE_ACCESS_TOKEN = "rotated";
    expect(readSession(cookie(createSession("Maya Okafor", Date.now())))).toBe("Maya Okafor");
    expect(readSession(cookie(v), 1000)).toBeNull();
  });
});
