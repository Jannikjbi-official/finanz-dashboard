"use client";

import { ArrowRight, Info, Warning } from "@phosphor-icons/react";
import { Button, Disclosure, Tooltip } from "@heroui/react";
import Link from "next/link";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { ItemStatus } from "@/components/finance/item-status";
import { SettleMenu } from "@/components/finance/settle-menu";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Figures, Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { COST_TYPE_LABEL, INTERVAL_UNIT } from "@/lib/domain/labels";
import { monthlyEquivalent } from "@/lib/domain/recurring";
import type { Dashboard } from "@/lib/domain/dashboard";
import type { Recurring, Transaction } from "@/lib/domain/types";
import { formatDate, formatDayShort, formatMoney, formatMonth, formatPercent, monthName } from "@/lib/format";

export function DashboardView({ dashboard, recurring, pending }: { dashboard: Dashboard; recurring: Recurring[]; pending: Transaction[] }) {
  const { openAccount, openTransaction } = useQuickAdd();

  if (!dashboard.hasAccounts) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Panel>
          <div className="flex flex-col gap-4 p-2">
            <div>
              <h1 className="text-xl font-semibold">Noch kein Konto erfasst</h1>
              <p className="mt-1 text-muted">
                Lege zuerst dein Girokonto mit dem heutigen Kontostand an. Danach zeigt die Übersicht, wie viel davon nach allen bekannten
                Zahlungen wirklich verfügbar ist.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onPress={() => openAccount()}>Konto anlegen</Button>
              <Link href="/einstellungen#import" className="inline-flex h-9 items-center rounded-[var(--radius)] px-3 text-muted hover:text-foreground">
                Oder Daten importieren
              </Link>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  const recurringById = new Map(recurring.map((entry) => [entry.id, entry]));
  const pendingById = new Map(pending.map((tx) => [tx.id, tx]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Übersicht</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <AvailabilityPanel dashboard={dashboard} className="lg:col-span-7" />
        <MonthPanel dashboard={dashboard} className="lg:col-span-5" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          id="upcoming"
          title="Kommende Zahlungen"
          description={`Noch anstehend bis Monatsende: ${formatMoney(dashboard.upcomingTotalUntilMonthEnd)}`}
          className="lg:col-span-7"
          bodyClassName=""
          action={
            <Button size="sm" variant="ghost" onPress={() => openTransaction("expense")}>
              Zahlung planen
            </Button>
          }
        >
          {dashboard.upcoming.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted sm:px-5">
              Keine offenen Zahlungen.{" "}
              <Link href="/feste-kosten" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                Feste Kosten erfassen
              </Link>
            </p>
          ) : (
            <UpcomingTable dashboard={dashboard} recurringById={recurringById} pendingById={pendingById} />
          )}
          {dashboard.paidThisMonth.length > 0 && <PaidThisMonth items={dashboard.paidThisMonth} />}
        </Panel>

        <SubscriptionsPanel dashboard={dashboard} className="lg:col-span-5" />
      </div>

      <Panel id="history" title="Einnahmen und Ausgaben" description="Gebuchte Beträge je Monat, ohne Transfers zwischen eigenen Konten">
        {dashboard.history.length === 0 ? (
          <p className="py-8 text-center text-muted">Sobald Buchungen erfasst sind, erscheint hier der Verlauf der letzten zwölf Monate.</p>
        ) : (
          <CashflowChart data={dashboard.history} />
        )}
      </Panel>
    </div>
  );
}

/* ----------------------------- Aktuell verfuegbar ----------------------------- */

function Line({
  label,
  value,
  sign,
  strong,
  muted,
  hint,
}: {
  label: React.ReactNode;
  value: number;
  sign?: "−" | "+" | "=";
  strong?: boolean;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "font-semibold" : ""} ${muted ? "text-muted" : ""}`}>
      <span className="flex min-w-0 items-baseline gap-2">
        <span aria-hidden className="num w-3 shrink-0 text-center text-muted">
          {sign ?? ""}
        </span>
        <span className="min-w-0">
          {label}
          {hint && <span className="label ml-1.5 font-normal">{hint}</span>}
        </span>
      </span>
      <Money cents={sign === "−" && value !== 0 ? -value : value} signed={sign === "+" || sign === "−"} tone={sign === "−" || sign === "+" ? "plain" : "auto"} />
    </div>
  );
}

function AvailabilityPanel({ dashboard, className }: { dashboard: Dashboard; className?: string }) {
  const a = dashboard.availability;
  const endLabel = formatDayShort(a.monthEnd);
  const lowBeforeIncome = a.lowestPoint.balance < 0;
  const count = (n: number) => (n === 1 ? "1 Posten" : `${n} Posten`);

  return (
    <section className={`panel flex flex-col ${className ?? ""}`} aria-labelledby="available-title">
      <div className="px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-center gap-1.5">
          <h2 id="available-title" className="label">
            Aktuell verfügbar
          </h2>
          <Tooltip delay={200}>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Wie wird das berechnet?" className="size-6 min-w-6">
              <Info className="size-3.5" />
            </Button>
            <Tooltip.Content placement="top" className="max-w-72 text-[12.5px]">
              Guthaben auf allen Konten, die zum verfügbaren Geld zählen, abzüglich fälliger und bis Monatsende geplanter Zahlungen. Noch nicht
              eingegangene Einnahmen zählen nicht.
            </Tooltip.Content>
          </Tooltip>
        </div>
        <div className={`kpi mt-1 ${a.available < 0 ? "text-danger" : ""}`}><Figures text={formatMoney(a.available)} /></div>
        <p className="mt-1 text-muted">nach allen bekannten Zahlungen bis {endLabel}</p>
      </div>

      <div className="mx-4 mt-2 border-t border-separator sm:mx-5">
        <div className="rows">
          <Line label="Kontostand" hint="tatsächlich" value={a.liquidBalance} />
          <Line label="Fällig, noch nicht bezahlt" hint={count(a.dueUnpaid.items.length)} value={a.dueUnpaid.total} sign="−" muted={a.dueUnpaid.total === 0} />
          <Line label={`Geplant bis ${endLabel}`} hint={count(a.plannedExpenses.items.length)} value={a.plannedExpenses.total} sign="−" muted={a.plannedExpenses.total === 0} />
          <Line label="Aktuell verfügbar" value={a.available} sign="=" strong />
          <Line label="Erwartete Einnahmen" hint="noch nicht eingegangen" value={a.expectedIncome.total} sign="+" muted={a.expectedIncome.total === 0} />
          <Line label={`Voraussichtlich am ${endLabel}`} hint="Prognose" value={a.projectedMonthEnd} sign="=" strong />
        </div>
      </div>

      {lowBeforeIncome && (
        <div className="mx-4 mt-2 flex items-start gap-2 rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-[13px] text-danger-soft-foreground sm:mx-5">
          <Warning className="mt-0.5 size-4 shrink-0" />
          <span>
            Der Kontostand fällt voraussichtlich am {formatDate(a.lowestPoint.date)} auf <Figures text={formatMoney(a.lowestPoint.balance)} />, bevor erwartete
            Einnahmen eingehen.
          </span>
        </div>
      )}

      <div className="mt-auto grid grid-cols-1 gap-4 border-t border-separator px-4 py-4 sm:grid-cols-3 sm:px-5">
        <div>
          <div className="label">Gesamt auf allen Konten</div>
          <div className="num mt-0.5 text-[15px] font-semibold"><Figures text={formatMoney(a.totalBalance)} /></div>
          {a.totalBalance !== a.liquidBalance && (
            <div className="label font-normal">davon <Figures text={formatMoney(a.totalBalance - a.liquidBalance)} /> zurückgelegt</div>
          )}
        </div>
        <div>
          <div className="label">Regelmäßige Einnahmen</div>
          <div className="num mt-0.5 text-[15px] font-semibold">
            <Figures text={formatMoney(dashboard.fixed.monthlyIncome)} /> <span className="font-normal text-muted">/ Monat</span>
          </div>
        </div>
        <div>
          <div className="label">Feste Kosten</div>
          <div className="num mt-0.5 text-[15px] font-semibold">
            <Figures text={formatMoney(dashboard.fixed.monthlyExpenses)} /> <span className="font-normal text-muted">/ Monat</span>
          </div>
          <div className="label font-normal">Durchschnitt inkl. Abos</div>
        </div>
      </div>
      {dashboard.unassignedCount > 0 && (
        <p className="border-t border-separator px-4 py-2.5 text-[12.5px] text-muted sm:px-5">
          {dashboard.unassignedCount} ältere Buchungen haben kein Konto und fließen nicht in den Kontostand ein.{" "}
          <Link href="/transaktionen?konto=ohne" className="text-foreground underline decoration-border underline-offset-4">
            Zuordnen
          </Link>
        </p>
      )}
    </section>
  );
}

/* --------------------------------- Monat --------------------------------- */

function MonthPanel({ dashboard, className }: { dashboard: Dashboard; className?: string }) {
  const { current, previous, savings, baseline } = dashboard;
  const rows: Array<{ label: string; now: number; before: number; strong?: boolean; indent?: boolean; net?: boolean }> = [
    { label: "Einnahmen", now: current.income, before: previous.income },
    { label: "Ausgaben", now: current.expense, before: previous.expense },
    { label: "davon feste Kosten", now: current.fixed, before: previous.fixed, indent: true },
    { label: "davon variabel", now: current.variable, before: previous.variable, indent: true },
    { label: current.net >= 0 ? "Überschuss" : "Fehlbetrag", now: current.net, before: previous.net, strong: true, net: true },
  ];

  return (
    <Panel id="month" title={formatMonth(dashboard.month)} description="Gebuchte Beträge, ohne Transfers" className={className} bodyClassName="px-4 pb-4 sm:px-5">
      <table className="w-full">
        <thead>
          <tr className="label border-b border-separator">
            <th className="py-2 text-left font-medium">
              <span className="sr-only">Posten</span>
            </th>
            <th className="py-2 text-right font-medium">bisher</th>
            <th className="py-2 pl-4 text-right font-medium">{monthName(previous.month)}</th>
          </tr>
        </thead>
        <tbody className="num">
          {rows.map((row) => (
            <tr key={row.label} className={`border-b border-separator last:border-0 ${row.strong ? "font-semibold" : ""}`}>
              <td className={`py-2 ${row.indent ? "pl-3 text-muted" : ""}`}>{row.label}</td>
              <td className="py-2 text-right">
                <Money cents={row.now} signed={row.net} tone={row.net ? "auto" : "plain"} />
              </td>
              <td className="py-2 pl-4 text-right text-muted">
                <Money cents={row.before} signed={row.net} tone="muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 rounded-[var(--radius)] bg-surface-secondary px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">Realistisch sparbar</span>
          {savings ? <Money cents={savings.amount} className="text-[17px] font-semibold" /> : <span className="text-muted">–</span>}
        </div>
        <p className="label mt-1 font-normal">
          {savings ? (
            <>
              <Figures text={formatMoney(savings.income)} /> Einnahmen (inkl. erwarteter) − <Figures text={formatMoney(savings.committed)} /> Ausgaben und Verpflichtungen
              {savings.variableReserve !== null && baseline
                ? ` − ${formatMoney(savings.variableReserve)} geschätzte variable Ausgaben für ${savings.remainingDays} Tage (Ø ${baseline.months.length} ${baseline.months.length === 1 ? "Monat" : "Monate"})`
                : ". Variable Ausgaben für den Rest des Monats sind noch nicht geschätzt – dafür fehlt ein abgeschlossener Monat."}
            </>
          ) : (
            "Erfasse Einnahmen oder regelmäßige Einnahmen, um das Sparpotenzial zu berechnen."
          )}
        </p>
      </div>
    </Panel>
  );
}

/* ---------------------------- Kommende Zahlungen ---------------------------- */

function UpcomingTable({
  dashboard,
  recurringById,
  pendingById,
}: {
  dashboard: Dashboard;
  recurringById: Map<string, Recurring>;
  pendingById: Map<string, Transaction>;
}) {
  const monthEnd = dashboard.availability.monthEnd;
  let shownNextMonthHeader = false;

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="label border-b border-separator">
            <th className="py-2 pl-4 pr-3 text-left font-medium sm:pl-5">Fällig</th>
            <th className="py-2 text-left font-medium">Zahlung</th>
            <th className="py-2 text-right font-medium">Betrag</th>
            <th className="hidden py-2 pl-3 text-right font-medium sm:table-cell">Kontostand danach</th>
            <th className="py-2 pr-4 sm:pr-5">
              <span className="sr-only">Aktionen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {dashboard.upcoming.map(({ item, balanceAfter }) => {
            const showHeader = item.date > monthEnd && !shownNextMonthHeader;
            if (showHeader) shownNextMonthHeader = true;
            return [
              showHeader ? (
                <tr key={`${item.key}-header`}>
                  <td colSpan={5} className="label border-b border-separator bg-surface-secondary/60 px-4 py-1.5 sm:px-5">
                    Anfang {monthName(item.date.slice(0, 7))}
                  </td>
                </tr>
              ) : null,
              <tr key={item.key} className="border-b border-separator last:border-0">
                <td className="w-[68px] whitespace-nowrap py-2.5 pl-4 pr-2 align-top text-muted sm:w-[76px] sm:pl-5 sm:pr-3">
                  {formatDayShort(item.date)}
                </td>
                <td className="py-2.5 pr-3 align-top">
                  <div className="font-medium">{item.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                    <ItemStatus date={item.date} type={item.type} today={dashboard.today} />
                    {item.costType && <span className="label font-normal">{COST_TYPE_LABEL[item.costType]}</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap py-2.5 text-right align-top">
                  <Money cents={item.type === "income" ? item.amountCents : -item.amountCents} signed tone="plain" className={item.type === "income" ? "text-success" : ""} />
                </td>
                <td className="hidden whitespace-nowrap py-2.5 pl-3 text-right align-top text-muted sm:table-cell">
                  {balanceAfter === null ? "–" : <Money cents={balanceAfter} tone={balanceAfter < 0 ? "auto" : "muted"} />}
                </td>
                <td className="py-2 pl-2 pr-3 align-top sm:pr-4">
                  <SettleMenu
                    item={item}
                    recurring={item.source === "recurring" ? recurringById.get(item.sourceId) : undefined}
                    transaction={item.source === "transaction" ? pendingById.get(item.sourceId) : undefined}
                  />
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function PaidThisMonth({ items }: { items: Transaction[] }) {
  const total = items.reduce((sum, tx) => sum + tx.amountCents, 0);
  return (
    <Disclosure className="border-t border-separator">
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] text-muted hover:text-foreground sm:px-5">
          <span>
            Diesen Monat bereits bezahlt: {items.length} · <span className="num"><Figures text={formatMoney(total)} /></span>
          </span>
          <Disclosure.Indicator />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>
          <ul className="rows border-t border-separator">
            {items.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-2 sm:px-5">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="num w-14 shrink-0 text-muted">{formatDayShort(tx.date)}</span>
                  <span className="truncate">{tx.title}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="hidden text-[12.5px] text-success sm:inline">Bezahlt</span>
                  <Money cents={-tx.amountCents} tone="plain" />
                </span>
              </li>
            ))}
          </ul>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

/* ------------------------------- Abonnements ------------------------------- */

function SubscriptionsPanel({ dashboard, className }: { dashboard: Dashboard; className?: string }) {
  const { subscriptions: subs, subscriptionShare, shareBase, baseline } = dashboard;
  const { openRecurring } = useQuickAdd();
  const top = subs.mostExpensive.slice(0, 5);
  const maxMonthly = top.length > 0 ? monthlyEquivalent(top[0]) : 0;

  return (
    <Panel
      id="subscriptions"
      title="Abonnements"
      className={className}
      bodyClassName="px-4 pb-4 pt-4 sm:px-5"
      action={
        <Link href="/abonnements" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-foreground">
          Alle <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      {subs.activeCount === 0 && subs.runningOut.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-muted">Noch keine Abonnements erfasst.</p>
          <Button size="sm" variant="secondary" className="mt-3" onPress={() => openRecurring(null, { type: "expense", costType: "subscription" })}>
            Abonnement hinzufügen
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="label">pro Monat</div>
              <div className="num mt-0.5 text-[20px] font-semibold leading-7"><Figures text={formatMoney(subs.monthlyTotal)} /></div>
            </div>
            <div>
              <div className="label">pro Jahr</div>
              <div className="num mt-0.5 text-[20px] font-semibold leading-7"><Figures text={formatMoney(subs.yearlyTotal, { whole: subs.yearlyTotal >= 100000 })} /></div>
            </div>
            <div>
              <div className="label">aktiv</div>
              <div className="num mt-0.5 text-[20px] font-semibold leading-7">{subs.activeCount}</div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-2 border-t border-separator pt-3 text-[13px]">
            {subs.nextCharge && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Nächste Abbuchung</dt>
                <dd className="min-w-0 truncate text-right">
                  {subs.nextCharge.entry.title} · {formatDayShort(subs.nextCharge.date)} ·{" "}
                  <span className="num"><Figures text={formatMoney(subs.nextCharge.entry.amountCents)} /></span>
                </dd>
              </div>
            )}
            {subscriptionShare !== null && (
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">
                    Anteil an {shareBase === "average" ? "monatlichen Ausgaben" : "festen Kosten"}
                  </dt>
                  <dd className="num">{formatPercent(subscriptionShare)}</dd>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-default" aria-hidden>
                  <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(subscriptionShare, 1) * 100}%` }} />
                </div>
                <p className="label mt-1 font-normal">
                  {shareBase === "average" && baseline
                    ? `Bezogen auf Ø ${formatMoney(baseline.averageExpense)} Ausgaben der letzten ${baseline.months.length === 1 ? "Monats" : `${baseline.months.length} Monate`}`
                    : `Bezogen auf ${formatMoney(dashboard.fixed.monthlyExpenses)} feste Kosten pro Monat`}
                </p>
              </div>
            )}
          </dl>

          {(subs.deadlines.length > 0 || subs.runningOut.length > 0) && (
            <ul className="mt-4 flex flex-col gap-1.5 border-t border-separator pt-3 text-[13px]">
              {subs.deadlines.map(({ entry, deadline }) => (
                <li key={`d-${entry.id}`} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">
                    <span className="text-warning">Kündbar bis {formatDayShort(deadline)}</span> · {entry.title}
                  </span>
                  <span className="label shrink-0 font-normal">Vertragsende {formatDayShort(entry.endDate!)}</span>
                </li>
              ))}
              {subs.runningOut.map(({ entry, dues, remaining }) => (
                <li key={`r-${entry.id}`} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-muted">
                    Gekündigt · {entry.title} läuft bis {formatDayShort(entry.endDate!)}
                  </span>
                  <span className="num shrink-0 text-muted">
                    noch {dues.length}× · <Figures text={formatMoney(remaining)} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          {top.length > 0 && (
            <div className="mt-4 border-t border-separator pt-3">
              <div className="label mb-1">Teuerste Abonnements</div>
              <ul className="rows">
                {top.map((entry) => {
                  const perMonth = monthlyEquivalent(entry);
                  return (
                    <li key={entry.id} className="py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">{entry.title}</span>
                        <span className="num shrink-0">
                          <Figures text={formatMoney(perMonth)} /> <span className="text-muted">/ Monat</span>
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-default" aria-hidden>
                          <div className="h-full rounded-full bg-accent/80" style={{ width: `${maxMonthly ? (perMonth / maxMonthly) * 100 : 0}%` }} />
                        </div>
                        {entry.interval !== "monthly" && (
                          <span className="label shrink-0 font-normal">
                            <Figures text={formatMoney(entry.amountCents)} /> / {INTERVAL_UNIT[entry.interval]}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
