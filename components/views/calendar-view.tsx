"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Money } from "@/components/ui/money";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Status } from "@/components/ui/status";
import { shiftMonth } from "@/lib/domain/calendar";
import type { CalendarDay, MonthCalendar } from "@/lib/domain/month-calendar";
import type { Recurring, Transaction } from "@/lib/domain/types";
import { formatDate, formatMonth } from "@/lib/format";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Kompakte Betraege im Raster: "1,2 T" bzw. "12" (Cent fallen weg). */
function short(cents: number) {
  const euros = Math.abs(cents) / 100;
  if (euros >= 1000) return `${(euros / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} T`;
  // Kleinbetraege sonst als "0"
  if (euros < 10) return euros.toLocaleString("de-DE", { maximumFractionDigits: euros < 1 ? 2 : 0 });
  return Math.round(euros).toLocaleString("de-DE");
}

export function CalendarView({
  calendar,
  today,
  transactions,
  recurring,
}: {
  calendar: MonthCalendar;
  today: string;
  /** Buchungen im sichtbaren Zeitraum, zum Bearbeiten. */
  transactions: Transaction[];
  recurring: Recurring[];
}) {
  const { openTransaction, openRecurring } = useQuickAdd();
  const days = calendar.weeks.flat();
  const initial = days.find((day) => day.isToday) ?? days.find((day) => day.inMonth && day.entries.length > 0) ?? days.find((day) => day.inMonth)!;
  const [selectedDate, setSelectedDate] = useState(initial.date);
  const selected = days.find((day) => day.date === selectedDate) ?? initial;
  const txById = useMemo(() => new Map(transactions.map((tx) => [tx.id, tx])), [transactions]);
  const recurringById = useMemo(() => new Map(recurring.map((entry) => [entry.id, entry])), [recurring]);
  const { totals, month } = calendar;
  const currentMonth = today.slice(0, 7);

  const open = (entry: CalendarDay["entries"][number]) => {
    const tx = entry.transactionId ? txById.get(entry.transactionId) : undefined;
    if (tx) return openTransaction(tx.type, tx);
    const rec = entry.recurringId ? recurringById.get(entry.recurringId) : undefined;
    if (rec) openRecurring(rec);
  };

  return (
    <div>
      <PageHeader
        title="Kalender"
        description="Gebuchte Beträge und offene Termine je Tag"
        actions={
          <nav aria-label="Monat" className="flex items-center gap-1">
            <Link href={`/kalender?monat=${shiftMonth(month, -1)}`} className="rounded-[var(--radius)] p-1.5 text-muted hover:bg-default hover:text-foreground" aria-label="Vormonat">
              <CaretLeft className="size-4" />
            </Link>
            <span className="min-w-32 text-center text-[13.5px] font-medium">{formatMonth(month)}</span>
            <Link href={`/kalender?monat=${shiftMonth(month, 1)}`} className="rounded-[var(--radius)] p-1.5 text-muted hover:bg-default hover:text-foreground" aria-label="Nächster Monat">
              <CaretRight className="size-4" />
            </Link>
            {month !== currentMonth && (
              <Link href="/kalender" className="ml-1 rounded-[var(--radius)] px-2 py-1 text-[13px] text-muted hover:bg-default hover:text-foreground">
                Heute
              </Link>
            )}
          </nav>
        }
      />

      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 px-1 text-[13px]">
        <span>
          <span className="text-muted">Eingegangen </span>
          <Money cents={totals.income} tone="plain" className="text-success" />
        </span>
        <span>
          <span className="text-muted">Bezahlt </span>
          <Money cents={totals.expense} tone="plain" />
        </span>
        {(totals.openIncome > 0 || totals.openExpense > 0) && (
          <span className="text-muted">
            Offen: <Money cents={totals.openIncome} tone="plain" className="text-foreground" /> erwartet,{" "}
            <Money cents={totals.openExpense} tone="plain" className="text-foreground" /> zu zahlen
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <section className="panel overflow-hidden lg:col-span-8" aria-label={`Kalender ${formatMonth(month)}`}>
          <div className="grid grid-cols-7 border-b border-separator">
            {WEEKDAYS.map((name) => (
              <div key={name} className="label px-1 py-2 text-center">
                {name}
              </div>
            ))}
          </div>
          <div role="grid" className="grid grid-cols-7">
            {days.map((day) => {
              const isSelected = day.date === selected.date;
              const overdue = day.entries.some((entry) => entry.overdue && entry.amount < 0);
              const incomeOverdue = day.entries.some((entry) => entry.overdue && entry.amount > 0);
              return (
                <button
                  key={day.date}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`${formatDate(day.date)}: ${day.entries.length} Einträge`}
                  onClick={() => setSelectedDate(day.date)}
                  className={`flex min-h-16 flex-col items-stretch gap-0.5 border-b border-r border-separator p-1 text-left outline-none [&:nth-child(7n)]:border-r-0 focus-visible:bg-surface-secondary sm:min-h-24 sm:p-1.5 ${
                    isSelected ? "bg-surface-secondary" : "hover:bg-surface-secondary/60"
                  } ${day.inMonth ? "" : "opacity-40"}`}
                >
                  <span
                    className={`num inline-flex size-6 items-center justify-center self-start rounded-full text-[12.5px] ${
                      day.isToday ? "bg-accent font-semibold text-accent-foreground" : ""
                    }`}
                  >
                    {Number(day.date.slice(8))}
                  </span>
                  {/* Handy: Punkte, ab sm: Betraege */}
                  <span className="flex gap-0.5 sm:hidden" aria-hidden>
                    {day.income > 0 && <span className="size-1.5 rounded-full bg-success" />}
                    {day.expense > 0 && <span className="size-1.5 rounded-full bg-foreground/70" />}
                    {(day.openExpense > 0 || day.openIncome > 0) && <span className={`size-1.5 rounded-full ${overdue || incomeOverdue ? "bg-danger" : "bg-warning"}`} />}
                  </span>
                  <span className="num hidden flex-col text-[11.5px] leading-tight sm:flex" aria-hidden>
                    {day.income > 0 && <span className="text-success">+{short(day.income)}</span>}
                    {day.expense > 0 && <span>−{short(day.expense)}</span>}
                    {day.openExpense > 0 && <span className={overdue ? "text-danger" : "text-warning"}>−{short(day.openExpense)} offen</span>}
                    {day.openIncome > 0 && (
                      <span className={incomeOverdue ? "text-danger" : "text-muted"}>
                        +{short(day.openIncome)} {incomeOverdue ? "ausst." : "erw."}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <Panel title={formatDate(selected.date)} description={selected.isToday ? "Heute" : undefined} className="lg:col-span-4" bodyClassName="">
          {selected.entries.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13.5px] text-muted sm:px-5">Keine Buchungen und keine Termine.</p>
          ) : (
            <ul className="rows">
              {selected.entries.map((entry) => (
                <li key={entry.key}>
                  <button
                    type="button"
                    onClick={() => open(entry)}
                    className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-[13.5px] outline-none hover:bg-surface-secondary focus-visible:bg-surface-secondary sm:px-5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{entry.title}</span>
                      <span className="mt-0.5 block">
                        {entry.kind === "booked" ? (
                          <span className="label font-normal">{entry.amount > 0 ? "eingegangen" : "bezahlt"}</span>
                        ) : entry.overdue ? (
                          <Status tone="danger">{entry.amount > 0 ? "ausstehend" : "überfällig"}</Status>
                        ) : (
                          <Status tone={entry.amount > 0 ? "accent" : "warning"}>{entry.amount > 0 ? "erwartet" : "geplant"}</Status>
                        )}
                      </span>
                    </span>
                    <Money
                      cents={entry.amount}
                      signed
                      tone="plain"
                      className={`shrink-0 ${entry.amount > 0 ? "text-success" : ""} ${entry.kind === "open" ? "opacity-70" : ""}`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(selected.income > 0 || selected.expense > 0) && (
            <div className="flex justify-between border-t border-separator px-4 py-2.5 text-[13px] sm:px-5">
              <span className="text-muted">Saldo gebucht</span>
              <Money cents={selected.income - selected.expense} signed />
            </div>
          )}
        </Panel>
      </div>
      <p className="label mt-3 px-1 font-normal">
        Transfers zwischen eigenen Konten erscheinen nicht. Überfällige Termine stehen an ihrem ursprünglichen Tag. Beträge im Raster in Euro
        ohne Cent.
      </p>
    </div>
  );
}
