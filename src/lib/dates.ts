import {
  type CalendarDate,
  endOfMonth,
  getDayOfWeek,
  parseDate,
  startOfMonth,
  today as todayIn,
} from "@internationalized/date";

export const TIME_ZONE = "Europe/Berlin";
export const LOCALE = "de-DE";

/** Heutiges Datum in Berlin. */
export function today(): CalendarDate {
  return todayIn(TIME_ZONE);
}

export function todayIso(): string {
  return today().toString();
}

export function toIso(d: CalendarDate): string {
  return d.toString();
}

export function fromIso(iso: string): CalendarDate {
  return parseDate(iso);
}

/** "2026-11" → Monatsanfang */
export function monthStart(month: string): CalendarDate {
  return parseDate(`${month}-01`);
}

export function monthKey(d: CalendarDate): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  return monthKey(today());
}

export function isValidMonthKey(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthRange(month: string): { start: CalendarDate; end: CalendarDate } {
  const start = monthStart(month);
  return { start: startOfMonth(start), end: endOfMonth(start) };
}

export function shiftMonth(month: string, delta: number): string {
  return monthKey(monthStart(month).add({ months: delta }));
}

export function daysInMonth(d: CalendarDate): number {
  return endOfMonth(d).day;
}

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });
const monthShortFmt = new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function asUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** TT.MM.JJJJ */
export function formatDate(iso: string): string {
  return dateFmt.format(asUtcDate(iso));
}

/** "November 2026" */
export function formatMonth(month: string): string {
  return monthFmt.format(asUtcDate(`${month}-01`));
}

/** "Nov." */
export function formatMonthShort(month: string): string {
  return monthShortFmt.format(asUtcDate(`${month}-01`));
}

/** "Heute", "Gestern" oder "Montag, 3. November" */
export function formatDayHeading(iso: string): string {
  const t = today();
  if (iso === t.toString()) return "Heute";
  if (iso === t.subtract({ days: 1 }).toString()) return "Gestern";
  return weekdayFmt.format(asUtcDate(iso));
}

/** Tage zwischen zwei ISO-Daten (b - a). */
export function daysBetween(a: string, b: string): number {
  return fromIso(b).compare(fromIso(a));
}

export function weekdayIndex(d: CalendarDate): number {
  return getDayOfWeek(d, LOCALE);
}

/** Datum mit Tag im Monat, auf Monatsende begrenzt. */
export function withClampedDay(monthDate: CalendarDate, day: number): CalendarDate {
  const first = startOfMonth(monthDate);
  return first.set({ day: Math.min(day, daysInMonth(first)) });
}
