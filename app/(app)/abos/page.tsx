import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { requireUser } from "@/lib/session";
import { getCategories, getRecurring } from "@/lib/queries";
import { INTERVAL_LABEL, daysUntil, monthlyAmount, yearlyAmount } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/money";
import { CategoryBars } from "@/components/charts";
import { RecurringDialog } from "@/components/recurring-dialog";
import { ActionButton } from "@/components/action-button";
import { bookRecurring, deleteRecurring, toggleRecurring } from "@/lib/actions";

export default async function SubscriptionsPage() {
  const user = await requireUser();
  const [categories, entries] = await Promise.all([
    getCategories(user.id),
    getRecurring(user.id),
  ]);

  const byId = new Map(categories.map((category) => [category.id, category]));
  const active = entries.filter((entry) => entry.active);
  const expenses = active.filter((entry) => entry.type === "expense");
  const incomes = active.filter((entry) => entry.type === "income");

  const monthlyExpense = expenses.reduce(
    (sum, entry) => sum + monthlyAmount(entry.amountCents, entry.interval),
    0,
  );
  const monthlyIncome = incomes.reduce(
    (sum, entry) => sum + monthlyAmount(entry.amountCents, entry.interval),
    0,
  );

  const buckets = new Map<string, number>();
  for (const entry of expenses) {
    const key = entry.categoryId ?? "none";
    buckets.set(
      key,
      (buckets.get(key) ?? 0) + monthlyAmount(entry.amountCents, entry.interval),
    );
  }

  const slices = [...buckets.entries()]
    .map(([key, amountCents]) => {
      const category = key === "none" ? undefined : byId.get(key);
      return {
        name: category?.name ?? "Ohne Kategorie",
        color: category?.color ?? "#64748b",
        icon: category?.icon ?? "",
        amountCents,
      };
    })
    .sort((a, b) => b.amountCents - a.amountCents);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Abos &amp; Daueraufträge
          </h1>
          <p className="text-sm text-default-500">
            Alles was regelmäßig kommt oder geht.
          </p>
        </div>
        <RecurringDialog categories={categories} lockType="expense" />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-default-100 bg-content1/60 backdrop-blur">
          <CardBody className="gap-1 p-5">
            <span className="text-tiny uppercase tracking-wide text-default-400">
              Abos pro Monat
            </span>
            <span className="text-2xl font-semibold tabular-nums text-danger">
              {formatMoney(monthlyExpense)}
            </span>
            <span className="text-tiny text-default-400">
              {expenses.length} aktive Abos
            </span>
          </CardBody>
        </Card>

        <Card className="border border-default-100 bg-content1/60 backdrop-blur">
          <CardBody className="gap-1 p-5">
            <span className="text-tiny uppercase tracking-wide text-default-400">
              Abos pro Jahr
            </span>
            <span className="text-2xl font-semibold tabular-nums text-danger">
              {formatMoney(monthlyExpense * 12)}
            </span>
            <span className="text-tiny text-default-400">hochgerechnet</span>
          </CardBody>
        </Card>

        <Card className="border border-default-100 bg-content1/60 backdrop-blur">
          <CardBody className="gap-1 p-5">
            <span className="text-tiny uppercase tracking-wide text-default-400">
              Feste Einnahmen
            </span>
            <span className="text-2xl font-semibold tabular-nums text-success">
              {formatMoney(monthlyIncome)}
            </span>
            <span className="text-tiny text-default-400">pro Monat</span>
          </CardBody>
        </Card>

        <Card className="border border-default-100 bg-content1/60 backdrop-blur">
          <CardBody className="gap-1 p-5">
            <span className="text-tiny uppercase tracking-wide text-default-400">
              Fixkosten-Saldo
            </span>
            <span
              className={`text-2xl font-semibold tabular-nums ${
                monthlyIncome - monthlyExpense >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatMoney(monthlyIncome - monthlyExpense)}
            </span>
            <span className="text-tiny text-default-400">pro Monat übrig</span>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-default-100 bg-content1/60 backdrop-blur lg:col-span-2">
          <CardHeader className="pb-0">
            <h2 className="text-sm font-semibold">Alle Einträge</h2>
          </CardHeader>
          <CardBody className="p-5">
            {entries.length === 0 ? (
              <p className="py-10 text-center text-sm text-default-400">
                Noch keine Abos angelegt.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-default-100">
                {entries.map((entry) => {
                  const category = entry.categoryId
                    ? byId.get(entry.categoryId)
                    : undefined;
                  const days = daysUntil(entry.nextDue);

                  return (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm"
                          style={{
                            backgroundColor: `${category?.color ?? "#64748b"}22`,
                          }}
                        >
                          {category?.icon || (entry.type === "income" ? "+" : "-")}
                        </span>

                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate text-sm">
                            {entry.title}
                            {!entry.active ? (
                              <Chip size="sm" variant="flat">
                                pausiert
                              </Chip>
                            ) : null}
                          </p>
                          <p className="text-tiny text-default-400">
                            {INTERVAL_LABEL[entry.interval]} &middot; nächste Zahlung{" "}
                            {formatDate(entry.nextDue)}
                            {entry.active
                              ? days <= 0
                                ? " (fällig)"
                                : ` (in ${days} T.)`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-sm tabular-nums ${
                            entry.type === "income" ? "text-success" : "text-danger"
                          }`}
                        >
                          {formatMoney(entry.amountCents)}
                        </p>
                        <p className="text-tiny text-default-400">
                          = {formatMoney(monthlyAmount(entry.amountCents, entry.interval))}
                          /Monat &middot;{" "}
                          {formatMoney(yearlyAmount(entry.amountCents, entry.interval))}
                          /Jahr
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <ActionButton
                          action={bookRecurring}
                          id={entry.id}
                          color="primary"
                          variant="flat"
                          title="Als Buchung übernehmen"
                        >
                          Buchen
                        </ActionButton>
                        <ActionButton
                          action={toggleRecurring}
                          id={entry.id}
                          title={entry.active ? "Pausieren" : "Aktivieren"}
                        >
                          {entry.active ? "Pause" : "Start"}
                        </ActionButton>
                        <RecurringDialog
                          categories={categories}
                          entry={entry}
                          lockType="expense"
                          trigger={
                            <span className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-tiny text-default-500 hover:bg-default-100 hover:text-foreground">
                              Bearbeiten
                            </span>
                          }
                        />
                        <ActionButton
                          action={deleteRecurring}
                          id={entry.id}
                          color="danger"
                          confirm="Abo wirklich löschen?"
                          title="Löschen"
                        >
                          Löschen
                        </ActionButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="border border-default-100 bg-content1/60 backdrop-blur">
          <CardHeader className="pb-0">
            <h2 className="text-sm font-semibold">Abo-Kosten nach Kategorie</h2>
          </CardHeader>
          <CardBody className="p-5">
            <CategoryBars slices={slices} total={monthlyExpense} />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
