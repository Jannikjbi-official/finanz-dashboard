import type { Interval } from "./mongo";
import { addMonths, monthEnd, todayIn } from "./domain/calendar";
import {
  firstOccurrenceFrom,
  monthlyAmount as monthlyFromInterval,
  nextOccurrence,
  yearlyAmount as yearlyFromInterval,
} from "./domain/schedule";

/** Bis Nutzereinstellungen existieren, gilt deutsche Zeit statt Serverzeit (UTC). */
const DEFAULT_TIME_ZONE = "Europe/Berlin";

export function todayISO() {
  return todayIn(DEFAULT_TIME_ZONE);
}

export function toISO(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "2026-09" für den aktuellen Monat */
export function currentMonthKey() {
  return todayISO().slice(0, 7);
}

export function monthRange(monthKey: string) {
  return { start: `${monthKey}-01`, end: monthEnd(monthKey) };
}

export function shiftMonth(monthKey: string, delta: number) {
  return addMonths(`${monthKey}-01`, delta).slice(0, 7);
}

export function lastMonthKeys(count: number, from = currentMonthKey()) {
  return Array.from({ length: count }, (_, index) =>
    shiftMonth(from, index - (count - 1)),
  );
}

export const INTERVAL_LABEL: Record<Interval, string> = {
  weekly: "wöchentlich",
  monthly: "monatlich",
  quarterly: "vierteljährlich",
  yearly: "jährlich",
};

/** Betrag eines Intervalls auf einen Monatswert normalisieren. */
export function monthlyAmount(amountCents: number, interval: Interval) {
  return monthlyFromInterval(amountCents, interval);
}

export function yearlyAmount(amountCents: number, interval: Interval) {
  return yearlyFromInterval(amountCents, interval);
}

/**
 * Naechstes Faelligkeitsdatum. `anchorDay` haelt den urspruenglichen Tag
 * fest, damit ein Abo vom 31. nicht nach dem Februar auf den 3. rutscht.
 */
export function advance(dateISO: string, interval: Interval, anchorDay?: number) {
  return nextOccurrence(dateISO, interval, anchorDay);
}

/** Erste Faelligkeit ab heute. */
export function nextDueFrom(startDate: string, interval: Interval) {
  return firstOccurrenceFrom(startDate, interval, todayISO());
}

export function daysUntil(dateISO: string) {
  return Math.round((Date.parse(dateISO) - Date.parse(todayISO())) / 86_400_000);
}

/* ---------------------------- Unscharfe Daten ----------------------------- */

/** Letzter Tag des Monats zu "2026-10" oder "2026-10-05". */
export function endOfMonth(dateOrMonth: string) {
  return monthEnd(dateOrMonth.slice(0, 7));
}

export function startOfMonth(dateOrMonth: string) {
  return `${dateOrMonth.slice(0, 7)}-01`;
}
