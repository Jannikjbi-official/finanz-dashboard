import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth/session";
import { createExpense, createIncome } from "@/server/actions";

export const dynamic = "force-dynamic";

const queueSchema = z.object({
  items: z
    .array(
      z.object({
        type: z.enum(["expense", "income"]),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .max(200),
});

/** Offline erfasste Einträge nachträglich speichern (idempotent über clientId). */
export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const parsed = queueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });

  const results = [];
  for (const item of parsed.data.items) {
    const res = item.type === "expense" ? await createExpense(item.payload) : await createIncome(item.payload);
    results.push({ ok: res.ok, error: res.ok ? null : res.error });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ results });
}
