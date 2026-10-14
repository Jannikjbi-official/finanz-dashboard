import { addDays, daysBetween, monthEnd, monthOf, shiftMonth, type ISODate } from "./calendar";
import { fixedCostSummary, subscriptionSummary } from "./commitments";
import { dataStart, monthSummary, monthlyHistory, partialFrom, spendingBaseline } from "./ledger";
import { amountChanges } from "./amount-changes";
import { findRecurringMatches } from "./matching";
import { availability, openItems, savingsEstimate, type OpenItem } from "./overview";
import type { Account, Recurring, Transaction } from "./types";

/**
 * Alles, was die Startseite braucht, aus einem Datenstand berechnet.
 * Reine Funktion - getestet in dashboard.test.ts.
 */
export function buildDashboard(input: { accounts: Account[]; transactions: Transaction[]; recurring: Recurring[]; today: ISODate }) {
  const { accounts, transactions, recurring, today } = input;
  const month = monthOf(today);

  const avail = availability(input);
  const current = monthSummary(transactions, month);
  const previous = monthSummary(transactions, shiftMonth(month, -1));
  // Nur vollstaendig erfasste Monate zaehlen fuer Durchschnitte
  const start = dataStart(transactions);
  const baseline = spendingBaseline(transactions, today, 3, start);
  const subscriptions = subscriptionSummary(recurring, today);
  const fixed = fixedCostSummary(recurring);

  // Anteil der Abos an den monatlichen Ausgaben: Basis ist der eigene
  // Durchschnitt vollstaendiger Monate; ohne Historie - oder wenn der
  // Durchschnitt unplausibel unter den Abos liegt - die festen Kosten.
  // Die Abos sind Teil der festen Kosten, der Anteil bleibt so <= 100 %.
  const averageFits = baseline !== null && baseline.averageExpense > 0 && baseline.averageExpense >= subscriptions.monthlyTotal;
  const shareBase = averageFits ? "average" : fixed.monthlyExpenses > 0 ? "fixed" : null;
  const shareDenominator = shareBase === "average" ? baseline!.averageExpense : shareBase === "fixed" ? fixed.monthlyExpenses : 0;
  const subscriptionShare = shareDenominator > 0 ? subscriptions.monthlyTotal / shareDenominator : null;

  // Kommende Zahlungen: bis Monatsende mit Kontostand danach (Prognose,
  // inkl. erwarteter Einnahmen); zusaetzlich Ausgaben der naechsten 14 Tage
  // danach, damit kurz vor Monatsende die Liste nicht leer wirkt.
  const later = openItems(transactions, recurring, addDays(today, 14)).filter(
    (item) => item.type === "expense" && item.date > avail.monthEnd,
  );
  const upcoming: UpcomingRow[] = [
    // Ueberfaellige Einnahmen zuerst, ohne Kontostand danach: sie zaehlen nicht in die Prognose
    ...avail.overdueIncome.items.map((item) => ({ item, overdue: true, balanceAfter: null })),
    ...avail.forecast.map((point) => ({ item: point.item, overdue: point.item.date < today, balanceAfter: point.balanceAfter })),
    ...later.map((item) => ({ item, overdue: false, balanceAfter: null })),
  ];
  const paidThisMonth = transactions
    .filter((tx) => tx.recurringId && tx.status === "booked" && tx.type === "expense" && monthOf(tx.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    today,
    month,
    hasAccounts: accounts.some((account) => !account.archived),
    hasData: transactions.length > 0 || recurring.length > 0,
    unassignedCount: transactions.filter((tx) => !tx.accountId && tx.status === "booked").length,
    availability: avail,
    current,
    previous,
    /** Vormonat nur teilweise erfasst: erster erfasster Tag. */
    previousPartialFrom: partialFrom(previous.month, start),
    /** Vormonat ganz ohne Daten (Erfassung beginnt spaeter). */
    previousEmpty: start === null || start > monthEnd(previous.month),
    baseline,
    savings: savingsEstimate({ current, availability: avail, baseline }),
    /**
     * Prognose abzueglich geschaetzter variabler Ausgaben fuer die restlichen
     * Tage (Durchschnitt vollstaendiger Monate) - null ohne solchen Monat.
     */
    variableForecast: baseline
      ? (() => {
          const reserve = Math.round(baseline.variablePerDay * daysBetween(today, avail.monthEnd));
          return { reserve, projected: avail.projectedMonthEnd - reserve };
        })()
      : null,
    subscriptions,
    subscriptionShare,
    shareBase,
    fixed,
    history: monthlyHistory(transactions, month, 12).map((summary) => ({
      month: summary.month,
      income: summary.income,
      expense: summary.expense,
      partial: summary.month === month || partialFrom(summary.month, start) !== null,
      partialFrom: partialFrom(summary.month, start),
    })),
    upcoming,
    upcomingTotalUntilMonthEnd: avail.bankPending.total + avail.dueUnpaid.total + avail.plannedExpenses.total,
    /** Buchungen, die offenen Terminen zugeordnet werden koennen (#17). */
    matches: findRecurringMatches(recurring, transactions, today),
    /** Zugeordnete Zahlungen mit anderem Betrag als hinterlegt. */
    amountChanges: amountChanges(recurring, transactions),
    paidThisMonth,
  };
}

export type UpcomingRow = { item: OpenItem; overdue: boolean; balanceAfter: number | null };

export type Dashboard = ReturnType<typeof buildDashboard>;
