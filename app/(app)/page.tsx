import { Card, CardBody, CardHeader, Chip, Divider } from "@heroui/react";
import { requireUser } from "@/lib/session";
import { getDashboard } from "@/lib/queries";
import { currentMonthKey, INTERVAL_LABEL, daysUntil } from "@/lib/dates";
import { formatDate, formatMoney, formatSigned } from "@/lib/money";
import { CategoryBars, Donut, TrendChart } from "@/components/charts";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionDialog } from "@/components/transaction-dialog";

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "danger" | "primary";
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    danger: "text-danger",
    primary: "text-primary",
  }[tone];

  return (
    <Card className="border border-default-100 bg-content1/60 backdrop-blur">
      <CardBody className="gap-1 p-5">
        <span className="text-tiny uppercase tracking-wide text-default-400">
          {label}
        </span>
        <span className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
          {value}
        </span>
        {hint ? <span className="text-tiny text-default-400">{hint}</span> : null}
      </CardBody>
    </Card>
  );
}

function diffHint(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "keine Vormonatsdaten" : "neu";
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(0)}% zum Vormonat`;
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

  const data = await getDashboard(user.id, month);
  const saldo = data.monthTotals.income - data.monthTotals.expense;
  const totalExpense = data.monthTotals.expense;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-default-500">
            Hallo {user.name || user.email.split("@")[0]}, hier ist dein Überblick.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <MonthSwitcher month={month} />
          <TransactionDialog categories={data.categories} />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Einnahmen"
          value={formatMoney(data.monthTotals.income)}
          hint={diffHint(data.monthTotals.income, data.previousTotals.income)}
          tone="success"
        />
        <Stat
          label="Ausgaben"
          value={formatMoney(data.monthTotals.expense)}
          hint={diffHint(data.monthTotals.expense, data.previousTotals.expense)}
          tone="danger"
        />
        <Stat
          label="Saldo Monat"
          value={formatSigned(saldo)}
          hint={`Gesamt: ${formatSigned(data.allTime.income - data.allTime.expense)}`}
          tone={saldo >= 0 ? "success" : "danger"}
        />
        <Stat
          label="Abos monatlich"
          value={formatMoney(data.recurringMonthlyExpense)}
          hint={`${data.activeSubscriptions} aktiv - ${formatMoney(
            data.recurringMonthlyExpense * 12,
          )} pro Jahr`}
          tone="primary"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-default-100 bg-content1/60 backdrop-blur lg:col-span-2">
          <CardHeader className="flex items-center justify-between pb-0">
            <div>
              <h2 className="text-sm font-semibold">Verlauf</h2>
              <p className="text-tiny text-default-400">Letzte 6 Monate</p>
            </div>
            <div className="flex gap-3 text-tiny text-default-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> Einnahmen
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-danger" /> Ausgaben
              </span>
            </div>
          </CardHeader>
          <CardBody className="p-5">
            <TrendChart data={data.trend} />
          </CardBody>
        </Card>

        <Card className="border border-default-100 bg-content1/60 backdrop-blur">
          <CardHeader className="pb-0">
            <h2 className="text-sm font-semibold">Ausgaben nach Kategorie</h2>
          </CardHeader>
          <CardBody className="gap-5 p-5">
            <Donut
              slices={data.expenseByCategory.slice(0, 8)}
              total={totalExpense}
              label="Ausgaben"
            />
            <CategoryBars
              slices={data.expenseByCategory.slice(0, 6)}
              total={totalExpense}
            />
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-default-100 bg-content1/60 backdrop-blur">
          <CardHeader className="pb-0">
            <h2 className="text-sm font-semibold">Einnahmen nach Kategorie</h2>
          </CardHeader>
          <CardBody className="p-5">
            <CategoryBars
              slices={data.incomeByCategory}
              total={data.monthTotals.income}
            />
          </CardBody>
        </Card>

        <Card className="border border-default-100 bg-content1/60 backdrop-blur">
          <CardHeader className="flex items-center justify-between pb-0">
            <h2 className="text-sm font-semibold">Nächste Fälligkeiten</h2>
            <Chip size="sm" variant="flat" color="primary">
              {data.activeSubscriptions}
            </Chip>
          </CardHeader>
          <CardBody className="p-5">
            {data.upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-default-400">
                Keine aktiven Abos.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-default-100">
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
                          {INTERVAL_LABEL[entry.interval]} &middot;{" "}
                          {days <= 0
                            ? "fällig"
                            : days === 1
                              ? "morgen"
                              : `in ${days} Tagen`}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm tabular-nums ${
                          entry.type === "income" ? "text-success" : "text-danger"
                        }`}
                      >
                        {entry.type === "income" ? "+" : "-"}
                        {formatMoney(entry.amountCents)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="border border-default-100 bg-content1/60 backdrop-blur">
          <CardHeader className="pb-0">
            <h2 className="text-sm font-semibold">Letzte Buchungen</h2>
          </CardHeader>
          <CardBody className="p-5">
            {data.recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-default-400">
                In diesem Monat noch nichts gebucht.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-default-100">
                {data.recent.map((tx) => {
                  const category = data.categories.find(
                    (entry) => entry.id === tx.categoryId,
                  );
                  return (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {category?.icon ? `${category.icon} ` : ""}
                          {tx.title}
                        </p>
                        <p className="text-tiny text-default-400">
                          {formatDate(tx.date)}
                          {category ? ` - ${category.name}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm tabular-nums ${
                          tx.type === "income" ? "text-success" : "text-danger"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatMoney(tx.amountCents)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>

      <Divider className="opacity-0" />
    </div>
  );
}
