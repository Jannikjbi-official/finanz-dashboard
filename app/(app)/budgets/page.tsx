import { requireUser } from "@/lib/session";
import { getBudgetOverview, getGoals } from "@/lib/queries";
import { currentMonthKey } from "@/lib/dates";
import { formatMoney, MONTH_NAMES } from "@/lib/money";
import { MonthSwitcher } from "@/components/month-switcher";
import { BudgetRow } from "@/components/budget-row";
import { GoalCard, GoalDialog } from "@/components/goal-card";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/ui";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.m ?? "")
    ? params.m!
    : currentMonthKey();

  const [rows, goals] = await Promise.all([
    getBudgetOverview(user.id, month),
    getGoals(user.id),
  ]);

  const withBudget = rows.filter((row) => row.category.budgetCents);
  const budgetTotal = withBudget.reduce(
    (sum, row) => sum + (row.category.budgetCents ?? 0),
    0,
  );
  const spentTotal = withBudget.reduce((sum, row) => sum + row.spentCents, 0);
  const over = withBudget.filter(
    (row) => row.spentCents > (row.category.budgetCents ?? 0),
  );

  const goalTarget = goals.reduce((sum, goal) => sum + goal.targetCents, 0);
  const goalSaved = goals.reduce((sum, goal) => sum + goal.savedCents, 0);

  const [year, monthIndex] = month.split("-");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Budgets & Sparziele"
        description={`Monatsbudgets für ${MONTH_NAMES[Number(monthIndex) - 1]} ${year} und dein Sparfortschritt.`}
        actions={
          <>
            <MonthSwitcher month={month} basePath="/budgets" />
            <GoalDialog />
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Budget gesamt"
          value={formatMoney(budgetTotal)}
          hint={`${withBudget.length} Kategorien mit Budget`}
        />
        <StatCard
          label="Davon ausgegeben"
          value={formatMoney(spentTotal)}
          hint={
            budgetTotal > 0
              ? `${Math.round((spentTotal / budgetTotal) * 100)} % verbraucht`
              : "noch kein Budget gesetzt"
          }
          tone={spentTotal > budgetTotal ? "danger" : "default"}
        />
        <StatCard
          label="Über Budget"
          value={`${over.length}`}
          hint={
            over.length > 0
              ? over.map((row) => row.category.name).join(", ")
              : "alles im Rahmen"
          }
          tone={over.length > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Sparziele"
          value={formatMoney(goalSaved)}
          hint={
            goalTarget > 0
              ? `von ${formatMoney(goalTarget)} · ${Math.round((goalSaved / goalTarget) * 100)} %`
              : "noch kein Ziel angelegt"
          }
          tone="primary"
        />
      </section>

      <SectionCard
        title="Monatsbudgets"
        description="Pro Ausgaben-Kategorie. Klick auf den Knopf rechts, um ein Budget zu setzen."
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Noch keine Ausgaben-Kategorien."
            hint="Lege sie in den Einstellungen an."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-default-100/70">
            {rows.map((row) => (
              <BudgetRow
                key={row.category.id}
                category={row.category}
                spentCents={row.spentCents}
                averageCents={row.averageCents}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Sparziele</h2>
          <span className="hidden text-tiny text-default-400 sm:block">
            Unabhängig von den Buchungen – du pflegst den Stand selbst
          </span>
        </div>

        {goals.length === 0 ? (
          <SectionCard>
            <EmptyState
              title="Noch keine Sparziele."
              hint="Zum Beispiel „Urlaub 1.500 € bis Juni“ oder „Notgroschen 3.000 €“."
              action={<GoalDialog />}
            />
          </SectionCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
