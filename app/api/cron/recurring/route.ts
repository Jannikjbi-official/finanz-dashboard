import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAutoBooking } from "@/lib/server/auto-book";

export const dynamic = "force-dynamic";

/** Vercel Cron schickt "Authorization: Bearer <CRON_SECRET>" mit. */
function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt" }, { status: 503 });
  if (!authorized(request.headers.get("authorization"))) return NextResponse.json({ error: "Nicht erlaubt" }, { status: 401 });
  const result = await runAutoBooking();
  return NextResponse.json(result);
}
