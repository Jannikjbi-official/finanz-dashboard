import { addDays, addMonths, daysBetween, type ISODate } from "./calendar";
import { monthlyAmount, nextOccurrence, yearlyAmount } from "./schedule";
import type { Recurring } from "./types";

/** Schutz gegen Endlosschleifen bei sehr alten, nie gepflegten Eintraegen. */
const MAX_OCCURRENCES = 500;

/** Ankertag aus dem Startdatum, damit ein Termin am 31. nicht wandert. */
export function anchorDay(entry: Pick<Recurring, "startDate">) {
  return Number(entry.startDate.slice(8, 10));
}

/** Termin nach `date` gemaess Intervall und Ankertag. */
export function followingDue(entry: Pick<Recurring, "startDate" | "interval">, date: ISODate) {
  return nextOccurrence(date, entry.interval, anchorDay(entry));
}

/**
 * Bis wann ueberhaupt noch Termine entstehen koennen.
 * - aktiv: unbegrenzt (ein Vertragsende verlaengert sich i. d. R., es dient
 *   nur der Kuendigungsfrist)
 * - gekuendigt: nur bis zum hinterlegten Vertragsende, sonst gar nicht mehr
 * - pausiert/archiviert: keine
 */
export function lastPossibleDue(entry: Recurring): ISODate | null | "none" {
  switch (entry.status) {
    case "active":
      return null;
    case "cancelled":
      return entry.endDate ?? "none";
    default:
      return "none";
  }
}

/**
 * Offene Termine bis einschliesslich `until`, beginnend bei `nextDue`.
 * Termine vor heute sind ueberfaellig - sie bleiben offen, bis sie als
 * bezahlt/eingegangen markiert oder uebersprungen werden.
 */
export function openDues(entry: Recurring, until: ISODate): ISODate[] {
  const limit = lastPossibleDue(entry);
  if (limit === "none") return [];

  const end = limit !== null && limit < until ? limit : until;
  const result: ISODate[] = [];
  let current = entry.nextDue;

  while (current <= end && result.length < MAX_OCCURRENCES) {
    result.push(current);
    current = followingDue(entry, current);
  }
  return result;
}

/** Laeuft der Eintrag kuenftig noch weiter (fuer Kostenvergleiche)? */
export function isRunning(entry: Recurring) {
  return entry.status === "active";
}

/**
 * Monatlicher Vergleichswert: ein Jahresabo ueber 120 € entspricht 10 € im
 * Monat. Das ist ein Durchschnitt - abgebucht werden einmal 120 €.
 */
export function monthlyEquivalent(entry: Pick<Recurring, "amountCents" | "interval">) {
  return monthlyAmount(entry.amountCents, entry.interval);
}

export function yearlyTotal(entry: Pick<Recurring, "amountCents" | "interval">) {
  return yearlyAmount(entry.amountCents, entry.interval);
}

/**
 * Letzter Tag, an dem noch fristgerecht zum Vertragsende gekuendigt werden
 * kann. Nur wenn Vertragsende UND Frist hinterlegt sind - sonst null, es
 * wird nichts geschaetzt.
 */
export function cancellationDeadline(entry: Pick<Recurring, "endDate" | "noticePeriod">): ISODate | null {
  if (!entry.endDate || !entry.noticePeriod) return null;
  const { value, unit } = entry.noticePeriod;
  if (unit === "days") return addDays(entry.endDate, -value);
  if (unit === "weeks") return addDays(entry.endDate, -7 * value);
  return addMonths(entry.endDate, -value);
}

export type DueState = "overdue" | "today" | "soon" | "later";

export function dueState(date: ISODate, today: ISODate): DueState {
  const days = daysBetween(today, date);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "later";
}

/**
 * Termin erledigen (bezahlt, eingegangen oder uebersprungen). Erlaubt ist nur
 * der jeweils naechste offene Termin - so kann kein Termin doppelt erledigt
 * werden. Ergebnis: das neue `nextDue` oder null, wenn der Termin nicht passt.
 */
export function settleDue(entry: Pick<Recurring, "startDate" | "interval" | "nextDue">, due: ISODate): ISODate | null {
  if (due !== entry.nextDue) return null;
  return followingDue(entry, due);
}

/**
 * Gegenstueck beim Loeschen einer Buchung: War sie die Zahlung fuer den
 * zuletzt erledigten Termin, wird dieser wieder offen. Sonst bleibt alles.
 */
export function reopenDue(entry: Pick<Recurring, "startDate" | "interval" | "nextDue">, due: ISODate): ISODate | null {
  return followingDue(entry, due) === entry.nextDue ? due : null;
}
