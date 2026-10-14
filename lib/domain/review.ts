import { monthOf, monthStart, shiftMonth, type ISODate, type MonthKey } from "./calendar";
import { categoryBreakdown } from "./categories";
import { dataStart, isTransfer, monthSummary, partialFrom, spendingBaseline } from "./ledger";
import type { Category, Transaction } from "./types";

/**
 * Rueckblick auf einen Monat: was kam rein, was ging raus, wofuer, und wie
 * im Vergleich zum Vormonat und zum Durchschnitt vollstaendiger Monate.
 */
export function monthReview(transactions: Transaction[], categories: Category[], month: MonthKey, today: ISODate) {
  const start = dataStart(transactions);
  const summary = monthSummary(transactions, month);
  const previous = monthSummary(transactions, shiftMonth(month, -1));
  const baseline = spendingBaseline(transactions, monthStart(month), 3, start);
  const booked = transactions.filter((tx) => tx.status === "booked" && !isTransfer(tx) && monthOf(tx.date) === month);
  const expenses = booked.filter((tx) => tx.type === "expense");

  return {
    month,
    /** Monat noch nicht vorbei. */
    running: month >= monthOf(today),
    /** Erfasst erst ab diesem Tag (Datenbeginn mitten im Monat). */
    partialFrom: partialFrom(month, start),
    /** Vormonat ohne Daten oder nur teilweise erfasst: Vergleich nicht aussagekraeftig. */
    previousComparable: previous.count > 0 && partialFrom(previous.month, start) === null && (start === null || start <= monthStart(previous.month)),
    summary,
    previous,
    baseline,
    /** Anteil des Ueberschusses an den Einnahmen, null ohne Einnahmen. */
    savingsRate: summary.income > 0 ? summary.net / summary.income : null,
    expenseCategories: categoryBreakdown(transactions, categories, month, "expense"),
    incomeCategories: categoryBreakdown(transactions, categories, month, "income"),
    largest: [...expenses].sort((a, b) => b.amountCents - a.amountCents || a.date.localeCompare(b.date)).slice(0, 5),
    /** Bezahlte Termine regelmaessiger Zahlungen. */
    recurringPaid: { count: expenses.filter((tx) => tx.recurringId).length, total: summary.fixed },
    /** Tage mit mindestens einer Ausgabe. */
    spendingDays: new Set(expenses.map((tx) => tx.date)).size,
  };
}

export type MonthReview = ReturnType<typeof monthReview>;

/** Standard fuer den Rueckblick: der letzte abgeschlossene Monat. */
export function defaultReviewMonth(today: ISODate): MonthKey {
  return shiftMonth(monthOf(today), -1);
}
