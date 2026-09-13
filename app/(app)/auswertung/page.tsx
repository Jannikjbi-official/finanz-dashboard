import { requireUser } from "@/lib/session";
import { getCategories, getYearStats } from "@/lib/queries";
import { formatMoney, formatSigned, MONTH_NAMES } from "@/lib/money";
import { CategoryBars } from "@/components/charts";
import { TransactionList } from "@/components/transaction-list";
import { YearChart } from "@/components/year-chart";
import { YearSwitcher } from "@/components/year-switcher";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/ui";

function monthLabel(month: string) {
  const [year, index] = month.split("-");
  return `${MONTH_NAMES[Number(index) - 1]} ${year}`;
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const parsed = Number(params.y);
  const year =
    Number.isInteger(parsed) && parsed > 2000 && parsed < 2100
      ? parsed
      : new Date().getFullYear();

  const [stats, categories] = await Promise.all([
    getYearStats(user.id, year),
    getCategories(user.id),
  ]);

  const saldo = stats.totals.income - stats.totals.expense;
  const months = Math.max(1, stats.activeMonths);
  const hasData = stats.transactionCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auswertung"
        description={`Dein Jahr ${year} in Zahlen.`}
        actions={<YearSwitcher year={year} />}
      />

      {!hasData ? (
        <SectionCard>
          <EmptyState
            title={`Für ${year} gibt es noch keine Buchungen.`}
            hint="Wechsle das Jahr oder lege Buchungen an."
          />
        </SectionCard>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Einnahmen"
              value={formatMoney(stats.totals.income)}
              hint={`Ø ${formatMoney(Math.round(stats.totals.income / months))} pro Monat`}
              tone="success"
            />
            <StatCard
              label="Ausgaben"
              value={formatMoney(stats.totals.expense)}
              hint={`Ø ${formatMoney(Math.round(stats.totals.expense / months))} pro Monat`}
              tone="danger"
            />
            <StatCard
              label="Saldo"
              value={formatSigned(saldo)}
              hint={`${stats.transactionCount} Buchungen in ${stats.activeMonths} Monaten`}
              tone={saldo >= 0 ? "success" : "danger"}
            />
            <StatCard
              label="Sparquote"
              value={
                stats.totals.income > 0
                  ? `${Math.round((saldo / stats.totals.income) * 100)} %`
                  : "–"
              }
              hint="Anteil der Einnahmen, der übrig bleibt"
              tone={saldo >= 0 ? "primary" : "danger"}
            />
          </section>

          <SectionCard
            title="Monatsverlauf"
            description="Einnahmen, Ausgaben und Saldo je Monat"
            action={
              <div className="flex gap-3 text-tiny text-default-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success" /> Ein
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-danger" /> Aus
                </span>
              </div>
            }
          >
            <YearChart months={stats.months} />
          </SectionCard>

          <section className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Ausgaben nach Kategorie"
              description={`Gesamt ${formatMoney(stats.totals.expense)}`}
            >
              <CategoryBars
                slices={stats.expenseByCategory}
                total={stats.totals.expense}
              />
            </SectionCard>

            <SectionCard
              title="Einnahmen nach Kategorie"
              description={`Gesamt ${formatMoney(stats.totals.income)}`}
            >
              <CategoryBars
                slices={stats.incomeByCategory}
                total={stats.totals.income}
              />
            </SectionCard>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <SectionCard
              title="Größte Ausgaben"
              description="Die teuersten Einzelbuchungen des Jahres"
              className="lg:col-span-2"
            >
              <TransactionList
                rows={stats.topExpenses}
                categories={categories}
                emptyTitle="Keine Ausgaben erfasst."
              />
            </SectionCard>

            <div className="flex flex-col gap-3">
              <StatCard
                label="Bester Monat"
                value={stats.best ? formatSigned(stats.best.saldo) : "–"}
                hint={stats.best ? monthLabel(stats.best.month) : undefined}
                tone="success"
              />
              <StatCard
                label="Schwächster Monat"
                value={stats.worst ? formatSigned(stats.worst.saldo) : "–"}
                hint={stats.worst ? monthLabel(stats.worst.month) : undefined}
                tone="danger"
              />
              <StatCard
                label="Ø Buchungen"
                value={`${Math.round(stats.transactionCount / months)}`}
                hint="pro aktivem Monat"
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
