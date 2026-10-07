import { getCurrentUser } from "@/lib/session";
import { getAccounts, getCategories, getTransactions } from "@/lib/queries";
import { toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/money";
import { limitUser } from "@/lib/server/rate-limit";
import { exportUserData } from "@/lib/server/user-data";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/export              Buchungen als CSV
 * GET /api/export?year=2026    Buchungen eines Jahres als CSV
 * GET /api/export?format=json  vollstaendiger Datenexport (alle Bereiche)
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

  const url = new URL(request.url);
  const stamp = new Date().toISOString().slice(0, 10);

  if (url.searchParams.get("format") === "json") {
    const data = await exportUserData(user.id);
    const body = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        user: { name: user.name, email: user.email },
        ...data,
      },
      null,
      2,
    );

    return new Response(body, {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="datenexport-${stamp}.json"`,
      },
    });
  }

  const yearParam = url.searchParams.get("year");
  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : null;

  const [categories, accounts, all] = await Promise.all([
    getCategories(user.id),
    getAccounts(user.id),
    getTransactions(user.id),
  ]);

  const rows = year ? all.filter((tx) => tx.date.startsWith(year)) : all;

  const categoryById = new Map(categories.map((entry) => [entry.id, entry.name]));
  const accountById = new Map(accounts.map((entry) => [entry.id, entry.name]));

  const csv = toCsv(
    rows.map((tx) => ({
      Datum: formatDate(tx.date),
      Bezeichnung: tx.title,
      Betrag: (tx.amountCents / 100).toFixed(2).replace(".", ","),
      Typ: tx.transferGroupId ? "Umbuchung" : tx.type === "income" ? "Einnahme" : "Ausgabe",
      Richtung: tx.type === "income" ? "Eingang" : "Ausgang",
      Kategorie: tx.categoryId ? (categoryById.get(tx.categoryId) ?? "") : "",
      Konto: tx.accountId ? (accountById.get(tx.accountId) ?? "") : "",
      Notiz: tx.note ?? "",
    })),
  );

  const name = year ? `buchungen-${year}.csv` : `buchungen-${stamp}.csv`;

  return new Response(csv, {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
