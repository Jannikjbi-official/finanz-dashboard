import { addDays, addMonths, type ISODate } from "./calendar";

export type Interval = "weekly" | "monthly" | "quarterly" | "yearly";

export const INTERVAL_MONTHS: Record<Exclude<Interval, "weekly">, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/**
 * Naechster Termin nach `date`. Bei Monatsintervallen bleibt der
 * urspruengliche Tag erhalten (31.01. -> 28.02. -> 31.03.).
 */
export function nextOccurrence(date: ISODate, interval: Interval, anchorDay?: number): ISODate {
  if (interval === "weekly") return addDays(date, 7);
  return addMonths(date, INTERVAL_MONTHS[interval], anchorDay ?? Number(date.slice(8, 10)));
}

/** Erster Termin am oder nach `onOrAfter`, ausgehend vom Startdatum. */
export function firstOccurrenceFrom(
  startDate: ISODate,
  interval: Interval,
  onOrAfter: ISODate,
): ISODate {
  if (startDate >= onOrAfter) return startDate;

  const anchorDay = Number(startDate.slice(8, 10));

  if (interval === "weekly") {
    const start = Date.parse(startDate);
    const target = Date.parse(onOrAfter);
    const weeks = Math.ceil((target - start) / (7 * 86_400_000));
    return addDays(startDate, weeks * 7);
  }

  // Monatsintervalle: direkt springen statt Schleife ueber Jahrzehnte
  const step = INTERVAL_MONTHS[interval];
  const monthsApart =
    (Number(onOrAfter.slice(0, 4)) - Number(startDate.slice(0, 4))) * 12 +
    (Number(onOrAfter.slice(5, 7)) - Number(startDate.slice(5, 7)));
  let steps = Math.max(0, Math.floor(monthsApart / step) - 1);
  let candidate = addMonths(startDate, steps * step, anchorDay);

  while (candidate < onOrAfter) {
    steps += 1;
    candidate = addMonths(startDate, steps * step, anchorDay);
  }
  return candidate;
}

/** Alle Termine im Fenster [from, to], hoechstens `limit`. */
export function occurrencesBetween(
  startDate: ISODate,
  interval: Interval,
  from: ISODate,
  to: ISODate,
  limit = 1000,
): ISODate[] {
  const result: ISODate[] = [];
  const anchorDay = Number(startDate.slice(8, 10));
  let current = firstOccurrenceFrom(startDate, interval, from);

  if (interval === "weekly") {
    while (current <= to && result.length < limit) {
      result.push(current);
      current = addDays(current, 7);
    }
    return result;
  }

  // Von startDate aus zaehlen, damit der Ankertag nie verloren geht
  const step = INTERVAL_MONTHS[interval];
  let n = 0;
  while (addMonths(startDate, n * step, anchorDay) < current) n += 1;
  while (current <= to && result.length < limit) {
    result.push(current);
    n += 1;
    current = addMonths(startDate, n * step, anchorDay);
  }
  return result;
}

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

/** Jahreswert exakt aus der Anzahl Termine pro Jahr (nicht Monatswert x 12). */
export function yearlyAmount(amountCents: number, interval: Interval) {
  const perYear = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 }[interval];
  return amountCents * perYear;
}
