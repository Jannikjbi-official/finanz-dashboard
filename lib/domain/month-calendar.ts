import { addDays, daysBetween, monthEnd, monthOf, monthStart, type ISODate, type MonthKey } from "./calendar";
import { isTransfer, signedAmount } from "./ledger";
import { openItems } from "./overview";
import type { Cents, Recurring, Transaction } from "./types";

/**
 * Monatskalender: je Tag die gebuchten Bewegungen und die offenen Termine
 * (regelmaessige Zahlungen, geplante/erwartete Buchungen). Transfers
 * zwischen eigenen Konten zaehlen wie ueberall nicht als Ein-/Ausgabe.
 */

export type CalendarEntry = {
  key: string;
  title: string;
  /** Vorzeichenbehaftet: Einnahmen positiv. */
  amount: Cents;
  kind: "booked" | "open";
  /** Offener Termin, dessen Datum schon vorbei ist. */
  overdue: boolean;
  /** Buchung (zum Bearbeiten) bzw. regelmaessige Zahlung. */
  transactionId: string | null;
  recurringId: string | null;
};

export type CalendarDay = {
  date: ISODate;
  inMonth: boolean;
  isToday: boolean;
  income: Cents;
  expense: Cents;
  /** Offene Termine (Ausgaben positiv gezaehlt). */
  openExpense: Cents;
  openIncome: Cents;
  entries: CalendarEntry[];
};

export function monthCalendar(transactions: Transaction[], recurring: Recurring[], month: MonthKey, today: ISODate) {
  const first = monthStart(month);
  const last = monthEnd(month);
  // Wochen beginnen montags: zurueck bis zum Montag, vor bis zum Sonntag
  const weekday = (date: ISODate) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -weekday(first));
  const gridEnd = addDays(last, 6 - weekday(last));

  const days = new Map<ISODate, CalendarDay>();
  for (let offset = 0; offset <= daysBetween(gridStart, gridEnd); offset += 1) {
    const date = addDays(gridStart, offset);
    days.set(date, { date, inMonth: monthOf(date) === month, isToday: date === today, income: 0, expense: 0, openExpense: 0, openIncome: 0, entries: [] });
  }

  for (const tx of transactions) {
    if (tx.status !== "booked" || isTransfer(tx)) continue;
    const day = days.get(tx.date);
    if (!day) continue;
    if (tx.type === "income") day.income += tx.amountCents;
    else day.expense += tx.amountCents;
    day.entries.push({ key: `tx:${tx.id}`, title: tx.title, amount: signedAmount(tx), kind: "booked", overdue: false, transactionId: tx.id, recurringId: tx.recurringId });
  }

  // Offene Posten bis zum Ende des sichtbaren Rasters (inkl. ueberfaelliger)
  for (const item of openItems(transactions, recurring, gridEnd)) {
    const day = days.get(item.date);
    if (!day) continue;
    if (item.type === "income") day.openIncome += item.amountCents;
    else day.openExpense += item.amountCents;
    day.entries.push({
      key: item.key,
      title: item.title,
      amount: item.type === "income" ? item.amountCents : -item.amountCents,
      kind: "open",
      overdue: item.date < today,
      transactionId: item.source === "transaction" ? item.sourceId : null,
      recurringId: item.source === "recurring" ? item.sourceId : null,
    });
  }

  const list = [...days.values()];
  for (const day of list) day.entries.sort((a, b) => (a.kind === b.kind ? a.amount - b.amount : a.kind === "booked" ? -1 : 1));
  const inMonth = list.filter((day) => day.inMonth);
  return {
    month,
    weeks: Array.from({ length: list.length / 7 }, (_, index) => list.slice(index * 7, index * 7 + 7)),
    totals: {
      income: inMonth.reduce((sum, day) => sum + day.income, 0),
      expense: inMonth.reduce((sum, day) => sum + day.expense, 0),
      openIncome: inMonth.reduce((sum, day) => sum + day.openIncome, 0),
      openExpense: inMonth.reduce((sum, day) => sum + day.openExpense, 0),
    },
  };
}

export type MonthCalendar = ReturnType<typeof monthCalendar>;
