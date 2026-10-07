import type { Interval } from "./mongo";
import { monthEnd, todayIn } from "./domain/calendar";
import { firstOccurrenceFrom, nextOccurrence } from "./domain/schedule";

/**
 * Datumshilfen fuer die Server Actions. Die eigentliche Kalenderlogik steckt
 * getestet in lib/domain/calendar.ts und lib/domain/schedule.ts.
 */

/** Bis die Actions die Zeitzone des Nutzers kennen, gilt deutsche Zeit statt Serverzeit (UTC). */
const DEFAULT_TIME_ZONE = "Europe/Berlin";

export function todayISO() {
  return todayIn(DEFAULT_TIME_ZONE);
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

/** Letzter Tag des Monats zu "2026-10" oder "2026-10-05". */
export function endOfMonth(dateOrMonth: string) {
  return monthEnd(dateOrMonth.slice(0, 7));
}
