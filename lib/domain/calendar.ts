/**
 * Kalenderrechnung auf ISO-Datumsstrings ("2026-10-07").
 *
 * Alles rechnet in UTC, damit Server-Zeitzone und Sommerzeit keine Rolle
 * spielen. "Heute" haengt dagegen vom Nutzer ab und wird ueber dessen
 * Zeitzone bestimmt.
 */

export type ISODate = string;
export type MonthKey = string; // "2026-10"

const DAY_MS = 86_400_000;

function parts(date: ISODate) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

function toUTC(date: ISODate) {
  const { year, month, day } = parts(date);
  return Date.UTC(year, month - 1, day);
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUTC(toUTC(value)) === value;
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Heutiges Datum in der Zeitzone des Nutzers. */
export function todayIn(timeZone = "Europe/Berlin", now = new Date()): ISODate {
  // en-CA formatiert als YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * DAY_MS);
}

export function daysBetween(from: ISODate, to: ISODate) {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Monate addieren, ohne ueber das Monatsende hinauszulaufen.
 * `anchorDay` ist der Wunschtag (z. B. 31) - in kurzen Monaten wird auf den
 * letzten Tag gekappt, danach geht es wieder auf den 31.
 */
export function addMonths(date: ISODate, months: number, anchorDay?: number): ISODate {
  const { year, month, day } = parts(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const wanted = anchorDay ?? day;
  const clamped = Math.min(wanted, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${pad(targetMonth)}-${pad(clamped)}`;
}

export function monthOf(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function monthStart(month: MonthKey): ISODate {
  return `${month}-01`;
}

export function monthEnd(month: MonthKey): ISODate {
  const [year, m] = month.split("-").map(Number);
  return `${month}-${pad(daysInMonth(year, m))}`;
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  return monthOf(addMonths(`${month}-01`, delta));
}

/** Die letzten `count` Monate bis einschliesslich `until`, aelteste zuerst. */
export function monthsUntil(until: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, index) =>
    shiftMonth(until, index - (count - 1)),
  );
}

export function minDate(a: ISODate, b: ISODate) {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate) {
  return a > b ? a : b;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
