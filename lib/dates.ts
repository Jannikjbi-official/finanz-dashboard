import type { Interval } from "./mongo";

export function todayISO() {
  const now = new Date();
  return toISO(now);
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
  const [year, month] = monthKey.split("-").map(Number);
  const start = `${monthKey}-01`;
  const endDate = new Date(year, month, 0);
  return { start, end: toISO(endDate) };
}

export function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
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
  switch (interval) {
    case "weekly":
      return Math.round((amountCents * 52) / 12);
    case "monthly":
      return amountCents;
    case "quarterly":
      return Math.round(amountCents / 3);
    case "yearly":
      return Math.round(amountCents / 12);
  }
}

export function yearlyAmount(amountCents: number, interval: Interval) {
  return monthlyAmount(amountCents, interval) * 12;
}

/** Naechstes Faelligkeitsdatum ab einem Datum berechnen. */
export function advance(dateISO: string, interval: Interval) {
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  switch (interval) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return toISO(date);
}

/** Faelligkeit so lange weiterschieben, bis sie in der Zukunft liegt. */
export function nextDueFrom(startDate: string, interval: Interval) {
  const today = todayISO();
  let due = startDate;
  let guard = 0;

  while (due < today && guard < 5000) {
    due = advance(due, interval);
    guard += 1;
  }

  return due;
}

export function daysUntil(dateISO: string) {
  const [year, month, day] = dateISO.split("-").map(Number);
  const target = new Date(year, month - 1, day).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
}

/* ---------------------------- Unscharfe Daten ----------------------------- */

/** Letzter Tag des Monats zu "2026-10" oder "2026-10-05". */
export function endOfMonth(dateOrMonth: string) {
  const [year, month] = dateOrMonth.split("-").map(Number);
  return toISO(new Date(year, month, 0));
}

export function startOfMonth(dateOrMonth: string) {
  return `${dateOrMonth.slice(0, 7)}-01`;
}
