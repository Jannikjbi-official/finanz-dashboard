"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { bookRecurring, toggleRecurring } from "@/lib/actions";
import { monthlyAmount, yearlyAmount } from "@/lib/domain/schedule";
import { formatDayShort, formatMoney, formatPercent, formatRelativeDays } from "@/lib/format";
import { CHART_COLORS } from "@/ui/donut";
import { ActionButton } from "@/ui/action-button";
import { Button } from "@/ui/button";
import { Empty, Figures, Note, PageHeader, Pill, Swatch } from "@/ui/layout";
import { Money } from "@/ui/money";
import { cx } from "@/ui/cx";
import type { CategoryOption } from "@/features/shared/types";
import { INTERVAL_OPTIONS, RecurringSheet, type RecurringView } from "./recurring-sheet";

const INTERVAL_LABEL = Object.fromEntries(INTERVAL_OPTIONS.map((o) => [o.value, o.label])) as Record<RecurringView["interval"], string>;

export function RecurringPage({
  entries,
  categories,
  today,
}: {
  entries: RecurringView[];
  categories: CategoryOption[];
  today: string;
}) {
  const [editing, setEditing] = useState<RecurringView | null>(null);
  const [creating, setCreating] = useState<"income" | "expense" | null>(null);

  const active = entries.filter((e) => e.active);
  const sum = (kind: "income" | "expense") =>
    active.filter((e) => e.type === kind).reduce((s, e) => s + monthlyAmount(e.amountCents, e.interval), 0);
  const fixedMonthly = sum("expense");
  const incomeMonthly = sum("income");
  const fixedYearly = active.filter((e) => e.type === "expense").reduce((s, e) => s + yearlyAmount(e.amountCents, e.interval), 0);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const composition = active
    .filter((e) => e.type === "expense")
    .map((e) => ({ id: e.id, title: e.title, monthly: monthlyAmount(e.amountCents, e.interval) }))
    .sort((a, b) => b.monthly - a.monthly)
    .map((part, index) => ({ ...part, color: CHART_COLORS[index % CHART_COLORS.length] }));
  const daysTo = (date: string) => Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);

  function table(kind: "income" | "expense") {
    const rows = entries
      .filter((e) => e.type === kind)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.nextDue.localeCompare(b.nextDue));

    if (rows.length === 0) {
      return (
        <Empty
          title={kind === "expense" ? "Noch keine Fixkosten." : "Noch kein regelmäßiges Einkommen."}
          action={
            <Button onClick={() => setCreating(kind)}>
              <Plus size={14} weight="bold" /> {kind === "expense" ? "Fixkosten anlegen" : "Einkommen anlegen"}
            </Button>
          }
        >
          {kind === "expense"
            ? "Miete, Verträge, Versicherungen, Abos – alles, was regelmäßig abgeht."
            : "Gehalt, Rente, Unterhalt – die Prognose braucht deine festen Eingänge."}
        </Empty>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[14px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-ink-3">
              <th className="py-2 pr-3 font-medium">{kind === "expense" ? "Zahlung" : "Eingang"}</th>
              <th className="py-2 pr-3 font-medium">Nächster Termin</th>
              <th className="py-2 pr-3 text-right font-medium">Betrag</th>
              <th className="py-2 pr-3 text-right font-medium">pro Monat</th>
              <th className="py-2 pr-3 text-right font-medium">pro Jahr</th>
              <th className="hidden py-2 pr-3 text-right font-medium md:table-cell">in 5 Jahren</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => {
              const category = entry.categoryId ? categoryById.get(entry.categoryId) : null;
              const days = daysTo(entry.nextDue);
              const due = entry.active && days <= 0;
              const yearly = yearlyAmount(entry.amountCents, entry.interval);
              return (
                <tr
                  key={entry.id}
                  onClick={() => setEditing(entry)}
                  className={cx("cursor-pointer border-b border-line hover:bg-surface-2", !entry.active && "text-ink-3")}
                >
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      {category ? <Swatch color={category.color} /> : <span className="size-2" />}
                      <span className="font-medium">{entry.title}</span>
                      {!entry.active ? <Pill>pausiert</Pill> : null}
                    </div>
                    <p className="ml-4 text-[12px] text-ink-3">
                      {INTERVAL_LABEL[entry.interval]}
                      {category ? ` · ${category.name}` : ""}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    {entry.active ? (
                      <>
                        <span className="num">{formatDayShort(entry.nextDue)}</span>
                        <span className={cx("ml-2 text-[12px]", due ? "text-warn" : "text-ink-3")}>
                          {due ? (days === 0 ? "heute fällig" : `seit ${-days} T. fällig`) : formatRelativeDays(days)}
                        </span>
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <Money cents={entry.amountCents} />
                  </td>
                  <td className="py-3 pr-3 text-right text-ink-2">
                    <Money cents={monthlyAmount(entry.amountCents, entry.interval)} />
                  </td>
                  <td className="py-3 pr-3 text-right text-ink-2">
                    <Money cents={yearly} />
                  </td>
                  <td className="hidden py-3 pr-3 text-right text-ink-3 md:table-cell">
                    <Money cents={yearly * 5} whole />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {entry.active && days <= 7 ? (
                        <ActionButton action={bookRecurring} fields={{ id: entry.id }} variant={due ? "primary" : "secondary"} aria-label={`${entry.title} als Buchung erfassen`}>
                          Buchen
                        </ActionButton>
                      ) : null}
                      <ActionButton action={toggleRecurring} fields={{ id: entry.id }} variant="ghost" aria-label={entry.active ? "Pausieren" : "Fortsetzen"}>
                        {entry.active ? "Pause" : "Fortsetzen"}
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Fixkosten"
        description="Alles, was regelmäßig kommt und geht. Daraus rechnet die Prognose."
        actions={
          <>
            <Button onClick={() => setCreating("income")}>Einkommen anlegen</Button>
            <Button variant="primary" onClick={() => setCreating("expense")}>
              <Plus size={15} weight="bold" /> Fixkosten anlegen
            </Button>
          </>
        }
      />

      <Figures
        className="mb-4"
        items={[
          { label: "Fixkosten pro Monat", value: <Money cents={fixedMonthly} />, note: `${active.filter((e) => e.type === "expense").length} aktive Posten`, tone: "accent" },
          { label: "pro Jahr", value: <Money cents={fixedYearly} whole /> },
          { label: "in 5 Jahren", value: <Money cents={fixedYearly * 5} whole />, note: "bei gleichbleibenden Beträgen" },
          {
            label: "Nach Fixkosten frei",
            value: <Money cents={incomeMonthly - fixedMonthly} tone="flow" />,
            note: `bei ${formatMoney(incomeMonthly, { whole: true })} festem Einkommen`,
          },
        ]}
      />

      {composition.length > 0 ? (
        <section className="card mb-4">
          <h2 className="mb-4 text-[17px] font-bold tracking-[-0.02em]">Woraus sich deine Fixkosten zusammensetzen</h2>
          <div className="flex h-4 gap-1 overflow-hidden rounded-full" aria-hidden>
            {composition.map((part) => (
              <span key={part.id} className="h-full rounded-full" style={{ width: `${(part.monthly / fixedMonthly) * 100}%`, background: part.color }} />
            ))}
          </div>
          <ul className="mt-4 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {composition.map((part) => (
              <li key={part.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: part.color }} />
                  <span className="truncate font-medium">{part.title}</span>
                </span>
                <span className="num font-semibold text-ink-2">{formatPercent(part.monthly / fixedMonthly)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-4">
        <section className="card">
          <h2 className="mb-3 text-[17px] font-bold tracking-[-0.02em]">Ausgaben</h2>
          {table("expense")}
        </section>
        <section className="card">
          <h2 className="mb-3 text-[17px] font-bold tracking-[-0.02em]">Einnahmen</h2>
          {table("income")}
        </section>
        <Note>
          „Buchen“ übernimmt einen fälligen Termin als echte Buchung auf dein erstes verfügbares Konto und springt zum nächsten Termin.
          Jahresbeträge rechnen mit der tatsächlichen Zahl der Termine (52 Wochen, 12 Monate, 4 Quartale).
        </Note>
      </div>

      <RecurringSheet key={editing?.id ?? "edit"} open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} entry={editing} categories={categories} today={today} />
      <RecurringSheet
        key={`new-${creating}`}
        open={creating !== null}
        onOpenChange={(o) => !o && setCreating(null)}
        categories={categories}
        today={today}
        defaultType={creating ?? "expense"}
      />
    </>
  );
}
