import { daysInMonth, type ISODate, type MonthKey } from "./calendar";

/**
 * Auffaelligkeiten bei Ausgaben - transparent gerechnet: Kategorie im
 * betrachteten Monat gegen den eigenen Durchschnitt der Vormonate.
 * Im laufenden Monat wird der Durchschnitt anteilig auf die bisherigen Tage
 * bezogen, damit ein halber Monat nicht gegen einen ganzen verglichen wird.
 */

export type CategoryHistory = {
  categoryId: string | null;
  name: string;
  /** Betrag im betrachteten Monat. */
  currentCents: number;
  /** Betraege der Vormonate (nur Monate, in denen ueberhaupt gebucht wurde). */
  previousCents: number[];
};

export type SpendingAnomaly = {
  categoryId: string | null;
  name: string;
  currentCents: number;
  /** Vergleichswert (anteilig im laufenden Monat). */
  expectedCents: number;
  averageCents: number;
  changeRatio: number; // +0.31 = 31 % mehr
  direction: "higher" | "lower" | "new";
  basisMonths: number;
};

export const ANOMALY_MIN_RATIO = 0.25;
export const ANOMALY_MIN_CENTS = 20_00;
export const NEW_CATEGORY_MIN_CENTS = 50_00;

export function findAnomalies(
  rows: CategoryHistory[],
  month: MonthKey,
  today: ISODate,
): SpendingAnomaly[] {
  const [year, m] = month.split("-").map(Number);
  const length = daysInMonth(year, m);
  const share = today.slice(0, 7) === month ? Number(today.slice(8, 10)) / length : 1;

  const result: SpendingAnomaly[] = [];

  for (const row of rows) {
    const basisMonths = row.previousCents.length;
    if (basisMonths === 0) continue;

    const averageCents = Math.round(row.previousCents.reduce((sum, value) => sum + value, 0) / basisMonths);
    const expectedCents = Math.round(averageCents * share);

    if (averageCents === 0) {
      if (row.currentCents >= NEW_CATEGORY_MIN_CENTS) {
        result.push({ ...base(row), expectedCents, averageCents, changeRatio: 1, direction: "new", basisMonths });
      }
      continue;
    }

    const diff = row.currentCents - expectedCents;
    const changeRatio = expectedCents > 0 ? diff / expectedCents : 0;

    // Weniger als erwartet ist im laufenden Monat kein Signal (Monat nicht vorbei)
    if (share < 1 && diff < 0) continue;
    if (Math.abs(changeRatio) < ANOMALY_MIN_RATIO || Math.abs(diff) < ANOMALY_MIN_CENTS) continue;

    result.push({
      ...base(row),
      expectedCents,
      averageCents,
      changeRatio,
      direction: diff > 0 ? "higher" : "lower",
      basisMonths,
    });
  }

  return result.sort((a, b) => Math.abs(b.currentCents - b.expectedCents) - Math.abs(a.currentCents - a.expectedCents));
}

function base(row: CategoryHistory) {
  return { categoryId: row.categoryId, name: row.name, currentCents: row.currentCents };
}

/** Sparquote eines Zeitraums: Anteil der Einnahmen, der uebrig bleibt. */
export function savingsRate(incomeCents: number, expenseCents: number) {
  if (incomeCents <= 0) return null;
  return (incomeCents - expenseCents) / incomeCents;
}

/** Veraenderung in Prozent, null wenn kein Vergleichswert existiert. */
export function changeRatio(current: number, previous: number) {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
