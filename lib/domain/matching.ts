import { addDays, daysBetween, type ISODate } from "./calendar";
import { isTransfer } from "./ledger";
import { followingDue, lastPossibleDue } from "./recurring";
import type { Cents, Recurring, Transaction } from "./types";

/**
 * Abgleich regelmaessiger Zahlungen mit echten Buchungen.
 *
 * Kommt eine Zahlung per Import oder von Hand als Buchung, ohne dass der
 * Termin als bezahlt/eingegangen markiert wurde, bleibt er offen und zaehlt
 * doppelt. Hier werden passende Buchungen gesucht:
 *
 * - gleiche Art, passendes Konto (oder keins), noch keinem Termin zugeordnet
 * - Datum 5 Tage vor bis 10 Tage nach dem Termin
 * - Betrag innerhalb max(2 €, 10 %) oder ein aehnlicher Name (Titel/Anbieter)
 *
 * "sicher" (Betrag passt UND Name passt) wird beim Import direkt zugeordnet,
 * "vielleicht" nur vorgeschlagen. Ein gleicher Betrag allein reicht nie fuer
 * "sicher" - 15 € beim Supermarkt sind kein 15-€-Abo.
 */

export const MATCH_WINDOW = { before: 5, after: 10 } as const;

export type MatchConfidence = "sure" | "maybe";

export type RecurringMatch = {
  recurringId: string;
  title: string;
  due: ISODate;
  expectedCents: Cents;
  transaction: Transaction;
  confidence: MatchConfidence;
  /** Abweichung Buchung minus Termin in Cent. */
  difference: Cents;
  nameMatch: boolean;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/** Gemeinsame Zeichenfolge von mindestens `min` Zeichen ("waisenrente" ~ "renten service"). */
export function similarName(a: string, b: string, min = 5) {
  const x = normalize(a);
  const y = normalize(b);
  if (x.length < min || y.length < min) return x.length > 0 && x === y;
  for (let start = 0; start + min <= x.length; start += 1) {
    if (y.includes(x.slice(start, start + min))) return true;
  }
  return false;
}

export function amountTolerance(expectedCents: Cents) {
  return Math.max(2_00, Math.round(expectedCents * 0.1));
}

function names(entry: Recurring) {
  return [entry.title, entry.provider ?? ""].filter(Boolean);
}

/** Bewertung einer einzelnen Buchung fuer einen Termin, null wenn sie nicht in Frage kommt. */
export function scoreMatch(entry: Recurring, due: ISODate, tx: Transaction): Omit<RecurringMatch, "recurringId" | "title" | "due" | "expectedCents" | "transaction"> | null {
  if (tx.status !== "booked" || isTransfer(tx) || tx.recurringId || tx.type !== entry.type) return null;
  if (tx.dismissedRecurring?.includes(entry.id)) return null;
  if (entry.accountId && tx.accountId && tx.accountId !== entry.accountId) return null;
  const offset = daysBetween(due, tx.date);
  if (offset < -MATCH_WINDOW.before || offset > MATCH_WINDOW.after) return null;

  const difference = tx.amountCents - entry.amountCents;
  const amountFits = Math.abs(difference) <= amountTolerance(entry.amountCents);
  const nameMatch = names(entry).some((name) => similarName(name, tx.title) || (tx.note ? similarName(name, tx.note) : false));
  if (!amountFits && !nameMatch) return null;

  const sure = amountFits && nameMatch;
  return { confidence: sure ? "sure" : "maybe", difference, nameMatch };
}

/**
 * Alle Zuordnungen fuer offene Termine bis `today` (plus Vorlauf). Je Eintrag
 * werden die Termine der Reihe nach abgearbeitet - nur so bleibt die Regel
 * "alles vor nextDue ist erledigt" erhalten. Jede Buchung wird hoechstens
 * einmal vergeben, die beste Bewertung gewinnt.
 */
export function findRecurringMatches(recurring: Recurring[], transactions: Transaction[], today: ISODate): RecurringMatch[] {
  const until = addDays(today, 3);
  const used = new Set<string>();
  const result: RecurringMatch[] = [];
  const rank = (match: { confidence: MatchConfidence; nameMatch: boolean; difference: number }) =>
    (match.confidence === "sure" ? 0 : 1_000_000_000) + (match.nameMatch ? 0 : 100_000_000) + Math.abs(match.difference);

  for (const entry of recurring) {
    const limit = lastPossibleDue(entry);
    if (limit === "none") continue;
    let due = entry.nextDue;
    // Nur der jeweils naechste Termin kann erledigt werden: hoert beim ersten ohne Treffer auf
    for (let step = 0; step < 24 && due <= until && (limit === null || due <= limit); step += 1) {
      const candidates = transactions
        .filter((tx) => !used.has(tx.id))
        .map((tx) => ({ tx, score: scoreMatch(entry, due, tx) }))
        .filter((item): item is { tx: Transaction; score: NonNullable<ReturnType<typeof scoreMatch>> } => item.score !== null)
        .sort((a, b) => rank(a.score) - rank(b.score) || Math.abs(daysBetween(due, a.tx.date)) - Math.abs(daysBetween(due, b.tx.date)));
      const best = candidates[0];
      if (!best) break;
      used.add(best.tx.id);
      result.push({ recurringId: entry.id, title: entry.title, due, expectedCents: entry.amountCents, transaction: best.tx, ...best.score });
      // Ein unsicherer Vorschlag blockiert die folgenden Termine, bis er bestaetigt ist
      if (best.score.confidence !== "sure") break;
      due = followingDue(entry, due);
    }
  }
  return result.sort((a, b) => a.due.localeCompare(b.due));
}
