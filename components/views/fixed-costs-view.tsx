"use client";

import { Plus } from "@phosphor-icons/react";
import { Button, Tabs, type Key } from "@heroui/react";
import { useMemo, useState } from "react";
import { ItemStatus } from "@/components/finance/item-status";
import { RecurringTable } from "@/components/finance/recurring-table";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Figures, Money } from "@/components/ui/money";
import { PageHeader, Panel, SummaryCell } from "@/components/ui/panel";
import type { FixedCostSummary } from "@/lib/domain/commitments";
import { COST_TYPE_LABEL } from "@/lib/domain/labels";
import type { OpenItem } from "@/lib/domain/overview";
import type { Account, Recurring } from "@/lib/domain/types";
import { formatDayShort, formatMoney, formatPercent } from "@/lib/format";

export function FixedCostsView({
  summary,
  recurring,
  upcoming,
  available,
  monthEnd,
  accounts,
  today,
}: {
  summary: FixedCostSummary;
  recurring: Recurring[];
  upcoming: OpenItem[];
  available: number;
  monthEnd: string;
  accounts: Account[];
  today: string;
}) {
  const { openRecurring } = useQuickAdd();
  const [tab, setTab] = useState<Key>("expenses");
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const expenses = recurring.filter((entry) => entry.type === "expense" && entry.status !== "archived");
  const incomes = recurring.filter((entry) => entry.type === "income" && entry.status !== "archived");
  const archived = recurring.filter((entry) => entry.status === "archived");
  const upcomingExpenses = upcoming.filter((item) => item.type === "expense");
  const upcomingTotal = upcomingExpenses.reduce((sum, item) => sum + item.amountCents, 0);
  const leftAfterFixed = summary.monthlyIncome - summary.monthlyExpenses;

  if (recurring.length === 0) {
    return (
      <div>
        <PageHeader title="Feste Kosten" description="Regelmäßige Zahlungen und Einnahmen" />
        <Panel>
          <div className="py-8 text-center">
            <p className="font-medium">Noch keine regelmäßigen Zahlungen erfasst</p>
            <p className="mx-auto mt-1 max-w-md text-muted">
              Miete, Strom, Internet, Handy, Versicherungen und Abos – mit Betrag, Intervall und nächstem Termin. Daraus entstehen die geplanten
              Zahlungen in der Übersicht.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button onPress={() => openRecurring(null, { type: "expense", costType: "rent" })}>Feste Kosten hinzufügen</Button>
              <Button variant="secondary" onPress={() => openRecurring(null, { type: "income" })}>
                Regelmäßige Einnahme
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Feste Kosten"
        description="Regelmäßige Zahlungen, ihre Vergleichswerte und die tatsächlichen Termine"
        actions={
          <>
            <Button size="sm" variant="secondary" onPress={() => openRecurring(null, { type: "income" })}>
              Regelmäßige Einnahme
            </Button>
            <Button size="sm" onPress={() => openRecurring(null, { type: "expense", costType: "rent" })}>
              <Plus weight="bold" className="size-4" /> Feste Kosten
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <section className="panel grid grid-cols-2 md:grid-cols-4 md:divide-x md:divide-separator" aria-label="Monatliche Planung">
          <SummaryCell label="Feste Kosten pro Monat" hint="Durchschnitt inkl. Abos" value={<Figures text={formatMoney(summary.monthlyExpenses)} />} />
          <SummaryCell label="Pro Jahr" hint="Summe aller Termine" value={<Figures text={formatMoney(summary.yearlyExpenses)} />} />
          <SummaryCell label="Regelmäßige Einnahmen" hint={`${formatMoney(leftAfterFixed)} nach festen Kosten`} value={<Figures text={formatMoney(summary.monthlyIncome)} />} />
          <SummaryCell
            label="Nach bekannten Zahlungen"
            hint={`verfügbar bis ${formatDayShort(monthEnd)}`}
            value={<Money cents={available} />}
          />
        </section>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <Panel title="Nach Kostenart" description="Monatlicher Vergleichswert – keine tatsächliche Abbuchung" className="lg:col-span-6" bodyClassName="px-4 pb-3 sm:px-5">
            {summary.byType.length === 0 ? (
              <p className="py-6 text-center text-muted">Keine laufenden festen Kosten.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="label border-b border-separator">
                    <th className="py-2 text-left font-medium">Art</th>
                    <th className="py-2 text-right font-medium">pro Monat</th>
                    <th className="hidden py-2 text-right font-medium sm:table-cell">pro Jahr</th>
                    <th className="w-20 py-2 text-right font-medium">Anteil</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byType.map((group) => {
                    const share = summary.monthlyExpenses ? group.monthly / summary.monthlyExpenses : 0;
                    return (
                      <tr key={group.costType} className="border-b border-separator last:border-0">
                        <td className="py-2.5">
                          {COST_TYPE_LABEL[group.costType]} <span className="label font-normal">{group.count}</span>
                        </td>
                        <td className="py-2.5 text-right">
                          <Money cents={group.monthly} tone="plain" />
                        </td>
                        <td className="hidden py-2.5 text-right text-muted sm:table-cell">
                          <Money cents={group.yearly} tone="muted" />
                        </td>
                        <td className="py-2.5 pl-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1 w-10 overflow-hidden rounded-full bg-default" aria-hidden>
                              <div className="h-full rounded-full bg-foreground/70" style={{ width: `${share * 100}%` }} />
                            </div>
                            <span className="num w-9 text-right text-muted">{formatPercent(share)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel
            title="Nächste Termine"
            description={<>Tatsächliche Fälligkeiten der nächsten 30 Tage · Abbuchungen zusammen <Figures text={formatMoney(upcomingTotal)} /></>}
            className="lg:col-span-6"
            bodyClassName="px-4 pb-2 sm:px-5"
          >
            {upcoming.length === 0 ? (
              <p className="py-6 text-center text-muted">In den nächsten 30 Tagen ist nichts fällig.</p>
            ) : (
              <ul className="rows">
                {upcoming.slice(0, 12).map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-baseline gap-3">
                      <span className="w-14 shrink-0 text-muted">{formatDayShort(item.date)}</span>
                      <div className="min-w-0">
                        <div className="truncate">{item.title}</div>
                        <ItemStatus date={item.date} type={item.type} today={today} />
                      </div>
                    </div>
                    <Money cents={item.type === "income" ? item.amountCents : -item.amountCents} signed tone="plain" className={item.type === "income" ? "text-success" : ""} />
                  </li>
                ))}
              </ul>
            )}
            {upcoming.length > 12 && <p className="label py-2 font-normal">+ {upcoming.length - 12} weitere Termine</p>}
          </Panel>
        </div>

        <Tabs selectedKey={tab} onSelectionChange={setTab} variant="secondary">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Regelmäßige Zahlungen">
              <Tabs.Tab id="expenses">
                Ausgaben <span className="num ml-1 text-muted">{expenses.length}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="incomes">
                Einnahmen <span className="num ml-1 text-muted">{incomes.length}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="archived">
                Archiv <span className="num ml-1 text-muted">{archived.length}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="expenses" className="pt-3">
            <RecurringTable entries={expenses} today={today} accountName={accountName} showCostType emptyText="Keine festen Kosten erfasst." ariaLabel="Feste Kosten" />
          </Tabs.Panel>
          <Tabs.Panel id="incomes" className="pt-3">
            <RecurringTable entries={incomes} today={today} accountName={accountName} emptyText="Keine regelmäßigen Einnahmen erfasst." ariaLabel="Regelmäßige Einnahmen" />
          </Tabs.Panel>
          <Tabs.Panel id="archived" className="pt-3">
            <RecurringTable entries={archived} today={today} accountName={accountName} showCostType emptyText="Das Archiv ist leer." ariaLabel="Archiv" />
          </Tabs.Panel>
        </Tabs>
      </div>
    </div>
  );
}
