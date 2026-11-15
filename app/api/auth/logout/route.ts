import { NextResponse } from "next/server";
import { COOKIE, cookieOptions } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.cookies.set(COOKIE, "", cookieOptions(0));
  return res;
}
