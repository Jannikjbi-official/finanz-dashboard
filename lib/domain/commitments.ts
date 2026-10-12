import { addMonths, monthEnd, monthOf, shiftMonth, type ISODate, type MonthKey } from "./calendar";
import { cancellationDeadline, isRunning, monthlyEquivalent, openDues, yearlyTotal } from "./recurring";
import type { Cents, CostType, Recurring } from "./types";

/**
 * Auswertungen ueber regelmaessige Zahlungen: Abonnements und feste Kosten.
 *
 * Wichtig: Monats- und Jahreswerte sind Vergleichswerte (ein Jahresabo ueber
 * 120 € = 10 €/Monat). Tatsaechliche Abbuchungen kommen ausschliesslich aus
 * den Terminen (`openDues`).
 */

export const isSubscription = (entry: Recurring) => entry.type === "expense" && entry.costType === "subscription";
export const isFixedExpense = (entry: Recurring) => entry.type === "expense";

export type Charge = { entry: Recurring; date: ISODate };

/** Naechster offener Termin ueber mehrere Eintraege (auch ueberfaellige). */
export function nextCharge(entries: Recurring[], today: ISODate, horizonMonths = 24): Charge | null {
  const until = addMonths(today, horizonMonths);
  let best: Charge | null = null;
  for (const entry of entries) {
    const [date] = openDues(entry, until);
    if (date && (!best || date < best.date)) best = { entry, date };
  }
  return best;
}

/**
 * Tatsaechliche Abbuchungen je Kalendermonat fuer die naechsten `months`
 * Monate ab dem laufenden. Ueberfaellige Termine landen im laufenden Monat,
 * weil sie jetzt zu zahlen sind.
 */
export function chargesByMonth(entries: Recurring[], today: ISODate, months = 12) {
  const current = monthOf(today);
  const keys: MonthKey[] = Array.from({ length: months }, (_, index) => shiftMonth(current, index));
  const until = monthEnd(keys[keys.length - 1]);
  const buckets = new Map<MonthKey, { month: MonthKey; total: Cents; charges: Charge[] }>(
    keys.map((month) => [month, { month, total: 0, charges: [] }]),
  );

  for (const entry of entries) {
    for (const date of openDues(entry, until)) {
      const month = date < today ? current : monthOf(date);
      const bucket = buckets.get(month);
      if (!bucket) continue;
      bucket.total += entry.amountCents;
      bucket.charges.push({ entry, date });
    }
  }
  return [...buckets.values()];
}

export type SubscriptionSummary = {
  active: Recurring[];
  paused: Recurring[];
  cancelled: Recurring[];
  archived: Recurring[];
  activeCount: number;
  monthlyTotal: Cents;
  yearlyTotal: Cents;
  /** Gekuendigte Abos mit hinterlegtem Vertragsende, die noch abbuchen. */
  runningOut: Array<{ entry: Recurring; remaining: Cents; dues: ISODate[] }>;
  nextCharge: Charge | null;
  /** Aktive Abos nach Monatswert absteigend. */
  mostExpensive: Recurring[];
  /** Fristen, die in den naechsten 60 Tagen ablaufen. */
  deadlines: Array<{ entry: Recurring; deadline: ISODate }>;
};

export function subscriptionSummary(recurring: Recurring[], today: ISODate): SubscriptionSummary {
  const subscriptions = recurring.filter(isSubscription);
  const active = subscriptions.filter(isRunning);
  const cancelled = subscriptions.filter((entry) => entry.status === "cancelled");

  const runningOut = cancelled
    .map((entry) => {
      const dues = entry.endDate ? openDues(entry, entry.endDate) : [];
      return { entry, dues, remaining: dues.length * entry.amountCents };
    })
    .filter((item) => item.dues.length > 0);

  const horizon = addMonths(today, 2);
  const deadlines = active
    .map((entry) => ({ entry, deadline: cancellationDeadline(entry) }))
    .filter((item): item is { entry: Recurring; deadline: ISODate } =>
      item.deadline !== null && item.deadline >= today && item.deadline <= horizon,
    )
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  return {
    active,
    paused: subscriptions.filter((entry) => entry.status === "paused"),
    cancelled,
    archived: subscriptions.filter((entry) => entry.status === "archived"),
    activeCount: active.length,
    monthlyTotal: active.reduce((sum, entry) => sum + monthlyEquivalent(entry), 0),
    yearlyTotal: active.reduce((sum, entry) => sum + yearlyTotal(entry), 0),
    runningOut,
    nextCharge: nextCharge(subscriptions, today),
    mostExpensive: [...active].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a)),
    deadlines,
  };
}

export const COST_TYPE_ORDER: CostType[] = [
  "rent",
  "energy",
  "internet",
  "phone",
  "insurance",
  "subscription",
  "loan",
  "other",
];

export type FixedCostSummary = {
  /** Laufende feste Ausgaben (inkl. Abos). */
  expenses: Recurring[];
  /** Laufende regelmaessige Einnahmen. */
  incomes: Recurring[];
  monthlyExpenses: Cents;
  yearlyExpenses: Cents;
  monthlyIncome: Cents;
  yearlyIncome: Cents;
  byType: Array<{ costType: CostType; monthly: Cents; yearly: Cents; count: number }>;
};

export function fixedCostSummary(recurring: Recurring[]): FixedCostSummary {
  const running = recurring.filter(isRunning);
  const expenses = running.filter(isFixedExpense);
  const incomes = running.filter((entry) => entry.type === "income");

  const byType = COST_TYPE_ORDER.map((costType) => {
    const group = expenses.filter((entry) => entry.costType === costType);
    return {
      costType,
      count: group.length,
      monthly: group.reduce((sum, entry) => sum + monthlyEquivalent(entry), 0),
      yearly: group.reduce((sum, entry) => sum + yearlyTotal(entry), 0),
    };
  }).filter((group) => group.count > 0);

  return {
    expenses,
    incomes,
    monthlyExpenses: expenses.reduce((sum, entry) => sum + monthlyEquivalent(entry), 0),
    yearlyExpenses: expenses.reduce((sum, entry) => sum + yearlyTotal(entry), 0),
    monthlyIncome: incomes.reduce((sum, entry) => sum + monthlyEquivalent(entry), 0),
    yearlyIncome: incomes.reduce((sum, entry) => sum + yearlyTotal(entry), 0),
    byType,
  };
}
