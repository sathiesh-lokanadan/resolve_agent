import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";

export async function GET(req: Request) {
  const name = readSession(req.headers.get("cookie"));
  return NextResponse.json({ name }, { headers: { "cache-control": "no-store" } });
}
