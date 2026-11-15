import { NextResponse } from "next/server";
import { COOKIE, SESSION_SECONDS, authConfigured, cleanName, cookieOptions, createSession, tokenMatches } from "@/lib/auth";

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!authConfigured()) return json({ error: "Sign-in is not set up: the server has no RESOLVE_ACCESS_TOKEN." }, 503);
  let body: { name?: unknown; token?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    /* handled below */
  }
  const name = cleanName(body?.name);
  if (!name) return json({ error: "Enter your full name (first and last name, letters only)." }, 400);
  if (!tokenMatches(body?.token)) return json({ error: "That access token is not correct." }, 401);
  const res = json({ name });
  res.cookies.set(COOKIE, createSession(name), cookieOptions(SESSION_SECONDS));
  return res;
}
