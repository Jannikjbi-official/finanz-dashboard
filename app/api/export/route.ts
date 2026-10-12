import { toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { accounts, categories, transactions } from "@/lib/server/db";
import { limitUser } from "@/lib/server/rate-limit";
import { getCurrentUser } from "@/lib/server/session";
import { exportUserData } from "@/lib/server/user-data";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/export              Buchungen als CSV (Semikolon, Excel-tauglich)
 * GET /api/export?format=json  vollstaendige Sicherung aller eigenen Daten
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401, headers: NO_STORE });

  const limit = await limitUser(user.id, "export");
  if (!limit.allowed) {
    return new Response("Zu viele Exporte – bitte später erneut versuchen.", {
      status: 429,
      headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);

  if (new URL(request.url).searchParams.get("format") === "json") {
    const data = await exportUserData(user.id);
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="finanzen-sicherung-${stamp}.json"`,
      },
    });
  }

  const [rows, categoryDocs, accountDocs] = await Promise.all([
    transactions.find({ userId: user.id }).sort({ date: -1, createdAt: -1 }).toArray(),
    categories.find({ userId: user.id }).toArray(),
    accounts.find({ userId: user.id }).toArray(),
  ]);
  const categoryName = new Map(categoryDocs.map((doc) => [doc._id.toString(), doc.name]));
  const accountName = new Map(accountDocs.map((doc) => [doc._id.toString(), doc.name]));

  const csv = toCsv(
    rows.map((tx) => ({
      Datum: formatDate(tx.date),
      Beschreibung: tx.title,
      Betrag: ((tx.type === "income" ? 1 : -1) * tx.amountCents / 100).toFixed(2).replace(".", ","),
      Typ: tx.transferGroupId ? "Transfer" : tx.type === "income" ? "Einnahme" : "Ausgabe",
      Status: (tx.status ?? "booked") === "booked" ? (tx.type === "income" ? "eingegangen" : "bezahlt") : tx.type === "income" ? "erwartet" : "geplant",
      Kategorie: tx.categoryId ? (categoryName.get(tx.categoryId) ?? "") : "",
      Konto: tx.accountId ? (accountName.get(tx.accountId) ?? "") : "",
      Notiz: tx.note ?? "",
    })),
  );

  return new Response(csv || "﻿Datum;Beschreibung;Betrag;Typ;Status;Kategorie;Konto;Notiz\r\n", {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transaktionen-${stamp}.csv"`,
    },
  });
}
