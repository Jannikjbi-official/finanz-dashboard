import { addMonths, daysBetween, type ISODate } from "./calendar";
import { isTransfer } from "./ledger";
import { similarName } from "./matching";
import type { Cents, Interval, Recurring, Transaction, TxType } from "./types";

/**
 * Regelmaessige Zahlungen in Buchungen erkennen, die noch keinem Eintrag
 * zugeordnet sind: gleiche Bezeichnung (ohne Zahlen und Satzzeichen),
 * aehnlicher Betrag (+/- 10 %) und ein Abstand von etwa einem Monat
 * (25-35 Tage) oder einem Quartal (85-95 Tage), mindestens zweimal.
 */
export type RecurringSuggestion = {
  key: string;
  title: string;
  type: TxType;
  amountCents: Cents;
  interval: Interval;
  nextDue: ISODate;
  count: number;
  lastDate: ISODate;
  accountId: string | null;
};

export function suggestionKey(type: TxType, title: string) {
  const words = title
    .toLowerCase()
    .replace(/[0-9]+/g, " ")
    .replace(/[^a-zäöüß ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .slice(0, 3);
  return `${type}:${words.join(" ")}`;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export function detectRecurring(transactions: Transaction[], existing: Recurring[], dismissed: string[] = []): RecurringSuggestion[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.status !== "booked" || isTransfer(tx) || tx.recurringId) continue;
    const key = suggestionKey(tx.type, tx.title);
    if (key.endsWith(":")) continue;
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  }

  const result: RecurringSuggestion[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2 || dismissed.includes(key)) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const typical = median(sorted.map((tx) => tx.amountCents));
    const similar = sorted.filter((tx) => Math.abs(tx.amountCents - typical) <= Math.max(1_00, typical * 0.1));
    if (similar.length < 2) continue;

    const gaps = similar.slice(1).map((tx, index) => daysBetween(similar[index].date, tx.date));
    const interval: Interval | null = gaps.every((gap) => gap >= 25 && gap <= 35) ? "monthly" : gaps.every((gap) => gap >= 85 && gap <= 95) ? "quarterly" : null;
    if (!interval) continue;

    const last = similar[similar.length - 1];
    // Schon als regelmaessige Zahlung erfasst?
    if (existing.some((entry) => entry.type === last.type && entry.status !== "archived" && [entry.title, entry.provider ?? ""].some((name) => name && similarName(name, last.title)))) continue;

    result.push({
      key,
      title: last.title.slice(0, 80),
      type: last.type,
      amountCents: last.amountCents,
      interval,
      nextDue: addMonths(last.date, interval === "monthly" ? 1 : 3),
      count: similar.length,
      lastDate: last.date,
      accountId: last.accountId,
    });
  }
  return result.sort((a, b) => b.amountCents - a.amountCents);
}
