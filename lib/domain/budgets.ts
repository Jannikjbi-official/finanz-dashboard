import { daysInMonth, type ISODate, type MonthKey } from "./calendar";

/** Ab diesem Verbrauch wird ein Budget als "im Blick behalten" markiert. */
export const WATCH_RATIO = 0.8;

export type BudgetProjection = {
  budgetCents: number | null;
  spentCents: number;
  remainingCents: number | null;
  /** Erwarteter Stand am Monatsende. */
  projectedCents: number;
  /** Anteil des Monats, der schon vorbei ist (0..1). */
  elapsed: number;
  averageCents: number;
  status: "none" | "ok" | "watch" | "over" | "projected-over";
  /** Wie die Hochrechnung zustande kommt - fuer die Erklaerung in der UI. */
  method: "closed" | "pace" | "blended";
};

/**
 * Hochrechnung bis Monatsende. Laeuft der Monat noch, wird das bisherige
 * Tempo genutzt; am Monatsanfang ist das wenig aussagekraeftig, deshalb wird
 * dann der Durchschnitt der Vormonate anteilig beigemischt.
 */
export function projectBudget(
  input: { budgetCents: number | null; spentCents: number; averageCents: number },
  month: MonthKey,
  today: ISODate,
): BudgetProjection {
  const [year, m] = month.split("-").map(Number);
  const length = daysInMonth(year, m);
  const monthIsCurrent = today.slice(0, 7) === month;
  const monthIsPast = today.slice(0, 7) > month;

  const elapsedDays = monthIsPast ? length : monthIsCurrent ? Number(today.slice(8, 10)) : 0;
  const elapsed = elapsedDays / length;

  let projectedCents: number;
  let method: BudgetProjection["method"];

  if (monthIsPast) {
    projectedCents = input.spentCents;
    method = "closed";
  } else if (elapsedDays === 0) {
    projectedCents = Math.max(input.spentCents, input.averageCents);
    method = "blended";
  } else {
    const pace = (input.spentCents / elapsedDays) * length;
    // Gewicht des eigenen Tempos waechst mit dem Monat
    const blended = input.averageCents > 0 ? elapsed * pace + (1 - elapsed) * input.averageCents : pace;
    projectedCents = Math.round(Math.max(input.spentCents, blended));
    method = input.averageCents > 0 && elapsed < 1 ? "blended" : "pace";
  }

  const { budgetCents } = input;
  let status: BudgetProjection["status"] = "none";

  if (budgetCents !== null && budgetCents > 0) {
    if (input.spentCents > budgetCents) status = "over";
    else if (projectedCents > budgetCents) status = "projected-over";
    else if (input.spentCents >= budgetCents * WATCH_RATIO) status = "watch";
    else status = "ok";
  }

  return {
    budgetCents,
    spentCents: input.spentCents,
    remainingCents: budgetCents !== null ? budgetCents - input.spentCents : null,
    projectedCents,
    elapsed,
    averageCents: input.averageCents,
    status,
    method,
  };
}
