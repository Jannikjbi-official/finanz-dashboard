import { Chip } from "@heroui/react";
import NextLink from "next/link";
import { requireUser } from "@/lib/session";
import { getAccounts, getDashboard, getOpenRefundTotal } from "@/lib/queries";
import { currentMonthKey, INTERVAL_LABEL, daysUntil } from "@/lib/dates";
import { formatDate, formatMoney, formatSigned } from "@/lib/money";
import { CategoryBars, Donut, TrendChart } from "@/components/charts";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionDialog } from "@/components/transaction-dialog";
import { RecurringDialog } from "@/components/recurring-dialog";
import { RecurringList } from "@/components/recurring-list";
import { TransactionList } from "@/components/transaction-list";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/ui";
import { BalanceHero } from "@/components/balance-hero";

function diffHint(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "keine Vormonatsdaten" : "neu";
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(0)} % zum Vormonat`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.m ?? "")
    ? params.m!
    : currentMonthKey();

  const [data, accounts, openRefunds] = await Promise.all([
    getDashboard(user.id, month),
    getAccounts(user.id),
    getOpenRefundTotal(user.id),
  ]);

  const saldo = data.monthTotals.income - data.monthTotals.expense;
  const accountTotal = accounts.reduce(
    (sum, account) => sum + account.balanceCents,
    0,
  );
  // Mit Konten zaehlt der echte Kontostand, sonst alles Gebuchte seit Beginn.
  const available = accounts.length > 0
    ? accountTotal
    : data.allTime.income - data.allTime.expense;
  const fixSaldo = data.recurringMonthlyIncome - data.recurringMonthlyExpense;
  const totalExpense = data.monthTotals.expense;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hallo ${user.name || user.email.split("@")[0]}`}
        description="Dein Überblick für diesen Monat."
        actions={
          <>
            <MonthSwitcher month={month} />
            <TransactionDialog categories={data.categories} accounts={accounts} />
          </>
        }
      />

      <BalanceHero
        availableCents={available}
        fromAccounts={accounts.length > 0}
        accountCount={accounts.length}
        incomeTotalCents={data.allTime.income}
        expenseTotalCents={data.allTime.expense}
        monthExpenseCents={data.monthTotals.expense}
        openRecurringCents={data.openRecurringCents}
        openRecurringCount={data.openRecurringCount}
        openRefundCents={openRefunds.cents}
        openRefundCount={openRefunds.count}
      />

      {/* ---------- Monat ---------- */}
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Einnahmen"
          value={formatMoney(data.monthTotals.income)}
          hint={diffHint(data.monthTotals.income, data.previousTotals.income)}
          tone="success"
        />
        <StatCard
          label="Ausgaben"
          value={formatMoney(data.monthTotals.expense)}
          hint={diffHint(data.monthTotals.expense, data.previousTotals.expense)}
          tone="danger"
        />
        <StatCard
          label="Saldo"
          value={formatSigned(saldo)}
          hint="Einnahmen minus Ausgaben in diesem Monat"
          tone={saldo >= 0 ? "success" : "danger"}
        />
      </section>

      {/* ---------- Fixkosten ---------- */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Fixkosten</h2>
          <span className="hidden text-tiny text-default-400 sm:block">
            Abos und feste Einnahmen, auf den Monat gerechnet
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Abos pro Monat"
            value={formatMoney(data.recurringMonthlyExpense)}
            hint={`${data.activeSubscriptions} aktive Abos`}
            tone="danger"
          />
          <StatCard
            label="Abos pro Jahr"
            value={formatMoney(data.recurringMonthlyExpense * 12)}
            hint="hochgerechnet"
            tone="danger"
          />
          <StatCard
            label="Feste Einnahmen"
            value={formatMoney(data.recurringMonthlyIncome)}
            hint="pro Monat"
            tone="success"
          />
          <StatCard
            label="Fixkosten-Saldo"
            value={formatSigned(fixSaldo)}
            hint="pro Monat übrig"
            tone={fixSaldo >= 0 ? "success" : "danger"}
          />
        </div>
      </section>

      {/* ---------- Verlauf und Kategorien ---------- */}
      <section className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Verlauf"
          description="Letzte 6 Monate"
          className="lg:col-span-2"
          action={
            <div className="flex gap-3 text-tiny text-default-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> Einnahmen
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-danger" /> Ausgaben
              </span>
            </div>
          }
        >
          <TrendChart data={data.trend} />
        </SectionCard>

        <SectionCard title="Ausgaben nach Kategorie" bodyClassName="gap-5 p-5">
          {totalExpense === 0 ? (
            <EmptyState title="In diesem Monat noch keine Ausgaben." />
          ) : (
            <>
              <Donut
                slices={data.expenseByCategory.slice(0, 8)}
                total={totalExpense}
                label="Ausgaben"
              />
              <CategoryBars
                slices={data.expenseByCategory.slice(0, 6)}
                total={totalExpense}
              />
            </>
          )}
        </SectionCard>
      </section>

      {/* ---------- Listen ---------- */}
      <section className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Letzte Buchungen"
          className="lg:col-span-2"
          action={
            <NextLink
              href="/transaktionen"
              className="text-tiny text-primary hover:underline"
            >
              alle ansehen
            </NextLink>
          }
        >
          <TransactionList
            rows={data.recent}
            categories={data.categories}
            accounts={accounts}
            emptyTitle="In diesem Monat noch nichts gebucht."
          />
        </SectionCard>

        <SectionCard
          title="Nächste Abos"
          action={
            <NextLink href="/abos" className="text-tiny text-primary hover:underline">
              zu den Abos
            </NextLink>
          }
        >
          {data.upcoming.length === 0 ? (
            <EmptyState title="Keine aktiven Abos." />
          ) : (
            <ul className="flex flex-col divide-y divide-default-100/70">
              {data.upcoming.map((entry) => {
                const days = daysUntil(entry.nextDue);
                return (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{entry.title}</p>
                      <p className="text-tiny text-default-400">
                        {INTERVAL_LABEL[entry.interval]} · {formatDate(entry.nextDue)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm tabular-nums text-danger">
                        {formatMoney(entry.amountCents)}
                      </p>
                      {days <= 0 ? (
                        <Chip size="sm" color="warning" variant="flat">
                          fällig
                        </Chip>
                      ) : (
                        <p className="text-tiny text-default-400">in {days} T.</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </section>

      {/* ---------- Feste Einnahmen ---------- */}
      <SectionCard
        title="Feste Einnahmen"
        description="Gehalt und andere regelmäßige Eingänge"
        action={
          <RecurringDialog
            categories={data.categories}
            lockType="income"
            trigger={
              <span className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-success/15 px-3 text-tiny font-medium text-success transition-colors hover:bg-success/25">
                Anlegen
              </span>
            }
          />
        }
      >
        <RecurringList
          entries={data.recurringIncome}
          categories={data.categories}
          lockType="income"
          emptyTitle="Noch keine festen Einnahmen hinterlegt."
          emptyHint="Trag dein Gehalt ein, dann stimmt der Fixkosten-Saldo."
        />
      </SectionCard>
    </div>
  );
}
