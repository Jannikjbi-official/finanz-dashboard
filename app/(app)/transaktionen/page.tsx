import { requireUser } from "@/lib/session";
import { getAccounts, getCategories, getTransactions } from "@/lib/queries";
import { currentMonthKey } from "@/lib/dates";
import { formatMoney, formatSigned } from "@/lib/money";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionDialog } from "@/components/transaction-dialog";
import { TransactionFilters } from "@/components/transaction-filters";
import { TransactionList } from "@/components/transaction-list";
import { PageHeader, SectionCard, StatCard } from "@/components/ui";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; type?: string; cat?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.m ?? "")
    ? params.m!
    : currentMonthKey();

  const [categories, all, accounts] = await Promise.all([
    getCategories(user.id),
    getTransactions(user.id, { month }),
    getAccounts(user.id),
  ]);

  const rows = all.filter((tx) => {
    if (params.type === "income" && tx.type !== "income") return false;
    if (params.type === "expense" && tx.type !== "expense") return false;
    if (params.cat === "none" && tx.categoryId) return false;
    if (params.cat && params.cat !== "all" && params.cat !== "none") {
      if (tx.categoryId !== params.cat) return false;
    }
    return true;
  });

  const income = rows
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amountCents, 0);
  const expense = rows
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  const filtered = rows.length !== all.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buchungen"
        description="Alle Einnahmen und Ausgaben des Monats."
        actions={
          <>
            <MonthSwitcher month={month} basePath="/transaktionen" />
            <TransactionDialog categories={categories} accounts={accounts} />
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Einnahmen"
          value={formatMoney(income)}
          tone="success"
          hint={`${rows.filter((tx) => tx.type === "income").length} Buchungen`}
        />
        <StatCard
          label="Ausgaben"
          value={formatMoney(expense)}
          tone="danger"
          hint={`${rows.filter((tx) => tx.type === "expense").length} Buchungen`}
        />
        <StatCard
          label="Saldo"
          value={formatSigned(income - expense)}
          tone={income - expense >= 0 ? "success" : "danger"}
          hint={filtered ? "gefilterte Auswahl" : "gesamter Monat"}
        />
      </section>

      <SectionCard
        title={filtered ? `${rows.length} von ${all.length} Buchungen` : `${all.length} Buchungen`}
        action={<TransactionFilters
          categories={categories}
          month={month}
          type={params.type ?? "all"}
          category={params.cat ?? "all"}
        />}
      >
        <TransactionList
          rows={rows}
          categories={categories}
          accounts={accounts}
          emptyTitle={
            filtered
              ? "Keine Buchung passt zu diesem Filter."
              : "In diesem Monat noch nichts gebucht."
          }
          emptyHint={
            filtered ? undefined : "Lege oben rechts deine erste Buchung an."
          }
        />
      </SectionCard>
    </div>
  );
}
