import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** One shared access token for every user. Set RESOLVE_ACCESS_TOKEN on the server. Unset = nobody can sign in. */
export const COOKIE = "resolve_session";
export const SESSION_SECONDS = 8 * 60 * 60;

const accessToken = () => process.env.RESOLVE_ACCESS_TOKEN?.trim() || "";
const digest = (s: string) => createHash("sha256").update(s).digest();

export const authConfigured = () => accessToken().length > 0;

/** Constant-time comparison of the submitted token with the configured one. */
export function tokenMatches(input: unknown): boolean {
  const expected = accessToken();
  if (!expected || typeof input !== "string") return false;
  return timingSafeEqual(digest(input.trim()), digest(expected));
}

/** A full name: 2 to 5 words of letters, with spaces, dots, apostrophes and hyphens. Not an email or user id. */
export function cleanName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.normalize("NFC").replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 60) return null;
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(name)) return null;
  const words = name.split(" ");
  return words.length >= 2 && words.length <= 5 ? name : null;
}

const sign = (payload: string) => createHmac("sha256", accessToken()).update(payload).digest("base64url");

/** Signed, expiring cookie value. Changing the token invalidates every session. */
export function createSession(name: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ n: name, e: now + SESSION_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The signed-in user's name from a Cookie header, or null. */
export function readSession(cookieHeader: string | null | undefined, now = Date.now()): string | null {
  if (!accessToken() || !cookieHeader) return null;
  const raw = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  const value = raw?.slice(COOKIE.length + 1);
  const [payload, sig] = value?.split(".") ?? [];
  if (!payload || !sig) return null;
  const good = sign(payload);
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const { n, e } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof n === "string" && typeof e === "number" && e > now ? n : null;
  } catch {
    return null;
  }
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});
