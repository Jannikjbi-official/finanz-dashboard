import { getCurrentUser } from "@/lib/session";
import { getAccounts, getCategories, getTransactions } from "@/lib/queries";
import { toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/money";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  const [categories, accounts, all] = await Promise.all([
    getCategories(user.id),
    getAccounts(user.id),
    getTransactions(user.id),
  ]);

  const rows = yearParam
    ? all.filter((tx) => tx.date.startsWith(yearParam))
    : all;

  const categoryById = new Map(categories.map((entry) => [entry.id, entry.name]));
  const accountById = new Map(accounts.map((entry) => [entry.id, entry.name]));

  const csv = toCsv(
    rows.map((tx) => ({
      Datum: formatDate(tx.date),
      Bezeichnung: tx.title,
      Betrag: (tx.amountCents / 100).toFixed(2).replace(".", ","),
      Typ: tx.type === "income" ? "Einnahme" : "Ausgabe",
      Kategorie: tx.categoryId ? (categoryById.get(tx.categoryId) ?? "") : "",
      Konto: tx.accountId ? (accountById.get(tx.accountId) ?? "") : "",
      Notiz: tx.note ?? "",
    })),
  );

  const name = yearParam ? `buchungen-${yearParam}.csv` : "buchungen.csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
