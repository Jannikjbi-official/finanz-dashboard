import { addDays, daysBetween, monthOf, type ISODate } from "./calendar";
import { aboveAverage, categoryBreakdown, payeeKey, type CategoryStat } from "./categories";
import { isTransfer } from "./ledger";
import type { Category, Cents, Transaction } from "./types";

/**
 * Auffaelligkeiten, die einen zweiten Blick wert sind. Bewusst vorsichtig:
 * lieber eine Meldung zu wenig als staendige Fehlalarme. Jede laesst sich
 * mit "Passt" dauerhaft ausblenden (Schluessel in den Einstellungen).
 */

export type Anomaly =
  | { key: string; kind: "duplicate"; transactions: [Transaction, Transaction] }
  | { key: string; kind: "large"; transaction: Transaction; typical: Cents; categoryName: string | null }
  | { key: string; kind: "category"; stat: CategoryStat };

/** Wie weit zurueck geschaut wird. */
const RECENT_DAYS = 30;
const DUPLICATE_DAYS = 3;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/** Gleiche Art, gleicher Betrag, gleicher Empfaenger, hoechstens 3 Tage auseinander. */
function duplicates(transactions: Transaction[], since: ISODate): Anomaly[] {
  const candidates = transactions
    .filter((tx) => !isTransfer(tx) && tx.date >= since)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const result: Anomaly[] = [];
  const used = new Set<string>();
  for (let i = 0; i < candidates.length; i += 1) {
    const a = candidates[i];
    if (used.has(a.id)) continue;
    for (let j = i + 1; j < candidates.length; j += 1) {
      const b = candidates[j];
      if (daysBetween(a.date, b.date) > DUPLICATE_DAYS) break;
      if (used.has(b.id) || a.type !== b.type || a.amountCents !== b.amountCents) continue;
      if (a.accountId && b.accountId && a.accountId !== b.accountId) continue;
      if (payeeKey(a.title) !== payeeKey(b.title)) continue;
      // Beide aus derselben Importdatei: dort stehen sie wirklich zweimal
      if (a.importId && a.importId === b.importId) continue;
      // Teile derselben Aufteilung
      if (a.splitGroupId && a.splitGroupId === b.splitGroupId) continue;
      // Zwei verschiedene Termine derselben regelmaessigen Zahlung sind kein Doppel
      if (a.recurringId && a.recurringId === b.recurringId && a.recurringDue !== b.recurringDue) continue;
      used.add(a.id);
      used.add(b.id);
      result.push({ key: `dup:${[a.id, b.id].sort().join(":")}`, kind: "duplicate", transactions: [a, b] });
      break;
    }
  }
  return result;
}

/**
 * Einzelne Ausgabe weit ueber dem Ueblichen ihrer Kategorie (mind. 3x der
 * Median, mind. 50 € mehr). Erst ab 5 frueheren Buchungen der Kategorie.
 */
function largeExpenses(transactions: Transaction[], categories: Category[], since: ISODate, today: ISODate): Anomaly[] {
  const history = addDays(today, -180);
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const result: Array<Extract<Anomaly, { kind: "large" }>> = [];
  const expenses = transactions.filter((tx) => tx.type === "expense" && tx.status === "booked" && !isTransfer(tx) && !tx.recurringId);
  for (const tx of expenses) {
    if (tx.date < since || tx.date > today) continue;
    const peers = expenses.filter((other) => other.id !== tx.id && other.categoryId === tx.categoryId && other.date >= history && other.date <= today);
    if (peers.length < 5) continue;
    const typical = median(peers.map((other) => other.amountCents));
    if (tx.amountCents < typical * 3 || tx.amountCents - typical < 50_00) continue;
    result.push({ key: `large:${tx.id}`, kind: "large", transaction: tx, typical, categoryName: tx.categoryId ? (names.get(tx.categoryId) ?? null) : null });
  }
  return result.sort((a, b) => b.transaction.amountCents - a.transaction.amountCents);
}

/** Kategorien, die im laufenden Monat schon deutlich ueber ihrem Durchschnitt liegen (mind. 25 % und 20 €). */
function categories_(transactions: Transaction[], categories: Category[], today: ISODate): Anomaly[] {
  const month = monthOf(today);
  return categoryBreakdown(transactions, categories, month)
    .items.filter((stat) => aboveAverage(stat) && stat.average !== null && stat.amount - stat.average >= Math.max(20_00, stat.average * 0.25))
    .map((stat) => ({ key: `cat:${stat.id}:${month}`, kind: "category" as const, stat }));
}

export function findAnomalies(input: { transactions: Transaction[]; categories: Category[]; today: ISODate; dismissed?: string[] }): Anomaly[] {
  const { transactions, categories, today } = input;
  const dismissed = new Set(input.dismissed ?? []);
  const since = addDays(today, -RECENT_DAYS);
  return [...duplicates(transactions, since), ...largeExpenses(transactions, categories, since, today), ...categories_(transactions, categories, today)].filter(
    (anomaly) => !dismissed.has(anomaly.key),
  );
}
