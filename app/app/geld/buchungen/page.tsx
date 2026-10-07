import { requireUser } from "@/lib/session";
import { accounts, categories } from "@/lib/mongo";
import { listTransactions } from "@/lib/server/ledger";
import { getSettings } from "@/lib/server/user-data";
import { isMonthKey, todayIn } from "@/lib/domain/calendar";
import { LedgerView } from "@/features/geld/ledger-view";

export const metadata = { title: "Buchungen" };

type Search = { monat?: string; q?: string; typ?: string; kategorie?: string; konto?: string };

export default async function BuchungenPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timeZone);

  const monat = params.monat === "alle" ? "alle" : isMonthKey(params.monat) ? params.monat : today.slice(0, 7);
  const q = (params.q ?? "").slice(0, 80);
  // Eine Suche ohne Monatsangabe durchsucht alles
  const month = monat === "alle" || (q && !params.monat) ? null : monat;
  const typ = params.typ === "income" || params.typ === "expense" || params.typ === "transfer" ? params.typ : "";

  const [{ rows, truncated }, categoryDocs, accountDocs] = await Promise.all([
    listTransactions(user.id, {
      month,
      query: q,
      type: typ || null,
      categoryId: params.kategorie || null,
      accountId: params.konto || null,
    }),
    categories.find({ userId: user.id }).sort({ kind: 1, name: 1 }).toArray(),
    accounts.find({ userId: user.id }).sort({ createdAt: 1 }).toArray(),
  ]);

  return (
    <LedgerView
      rows={rows}
      truncated={truncated}
      today={today}
      filters={{
        monat: month ?? "alle",
        q,
        typ,
        kategorie: params.kategorie ?? "",
        konto: params.konto ?? "",
      }}
      categories={categoryDocs.map((doc) => ({ id: doc._id.toString(), name: doc.name, kind: doc.kind, color: doc.color }))}
      accounts={accountDocs.map((doc) => ({ id: doc._id.toString(), name: doc.name, color: doc.color, archived: doc.archived }))}
    />
  );
}
