import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { formatDate, todayIso } from "@/lib/dates";
import { getAllData } from "@/server/queries";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function euro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const data = await getAllData();
  const stamp = todayIso();

  if (format === "json") {
    const body = JSON.stringify({ app: "finanzen", version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
    return new NextResponse(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="finanzen-backup-${stamp}.json"`,
        "cache-control": "no-store",
      },
    });
  }

  // CSV (Excel-freundlich: Semikolon, Komma als Dezimaltrennzeichen, BOM)
  const cats = new Map(data.categories.map((c) => [c.id, c.name]));
  const lines = [["Typ", "Datum", "Betrag (€)", "Kategorie/Quelle", "Zahlungsart", "Notiz"].join(";")];
  for (const e of data.expenses) {
    lines.push(
      ["Ausgabe", formatDate(e.date), `-${euro(e.amountCents)}`, e.categoryId ? (cats.get(e.categoryId) ?? "") : "", e.paymentMethod, e.note]
        .map(csvCell)
        .join(";"),
    );
  }
  for (const i of data.incomes) {
    lines.push(["Einnahme", formatDate(i.date), euro(i.amountCents), i.source, "", i.note].map(csvCell).join(";"));
  }
  for (const s of data.subscriptions) {
    lines.push(
      ["Abo", formatDate(s.startDate), `-${euro(s.priceCents)}`, s.name, s.interval, `${s.status}${s.note ? ` – ${s.note}` : ""}`]
        .map(csvCell)
        .join(";"),
    );
  }
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="finanzen-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
