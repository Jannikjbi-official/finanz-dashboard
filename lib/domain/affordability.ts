import { addMonths, daysBetween, type ISODate } from "./calendar";
import {
  balanceAt,
  buildForecast,
  firstDayBelow,
  lowestPoint,
  type ForecastEvent,
  type ForecastInput,
  type GoalInput,
} from "./forecast";
import { delayInMonths } from "./goals";

/**
 * "Kann ich mir das leisten?" - eine Liquiditaetsrechnung, keine Beratung.
 *
 * Verglichen werden zwei Prognosen: ohne und mit dem Kauf. Daraus folgen
 * Tiefpunkt, Reserve, Zielkonflikte und die Zeit, bis der Betrag aus dem
 * laufenden Ueberschuss wieder hereingeholt ist.
 */

export type AffordabilityVerdict = "comfortable" | "possible" | "tight" | "not-affordable";

export const VERDICT_LABEL: Record<AffordabilityVerdict, string> = {
  comfortable: "Gut machbar",
  possible: "Machbar",
  tight: "Nur auf Kosten der Reserve",
  "not-affordable": "Nicht gedeckt",
};

export type Purchase = {
  label: string;
  amountCents: number;
  date: ISODate;
  /** Optional in Raten: Anzahl Monate (Betrag wird gleichmaessig verteilt). */
  installments?: number;
};

export type AffordabilityResult = {
  verdict: AffordabilityVerdict;
  purchase: Purchase;
  before: Snapshot;
  after: Snapshot;
  /** Freier Betrag ueber der Reserve im betrachteten Zeitraum (ohne Kauf). */
  headroomCents: number;
  /** Was ueber den Spielraum hinausgeht. */
  gapCents: number;
  reserveCents: number;
  /** Erster Tag unter der Reserve - nur mit Kauf. */
  reserveBreach: { date: ISODate; balanceCents: number } | null;
  /** Erster Tag im Minus - nur mit Kauf. */
  overdraft: { date: ISODate; balanceCents: number } | null;
  /** Durchschnittlicher Ueberschuss pro Monat laut Prognose (ohne Kauf). */
  monthlySurplusCents: number;
  recovery: { months: number; month: string } | null;
  goalImpacts: Array<{ goalId: string; title: string; delayMonths: number | null }>;
  horizonDays: number;
};

type Snapshot = {
  onDateCents: number;
  in30Cents: number;
  in90Cents: number;
  lowest: { date: ISODate; balanceCents: number };
};

export function purchaseEvents(purchase: Purchase): ForecastEvent[] {
  const parts = Math.max(1, Math.floor(purchase.installments ?? 1));
  const base = Math.floor(purchase.amountCents / parts);

  return Array.from({ length: parts }, (_, index) => ({
    date: addMonths(purchase.date, index),
    // Rundungsrest auf die erste Rate
    amountCents: -(base + (index === 0 ? purchase.amountCents - base * parts : 0)),
    label: parts > 1 ? `${purchase.label} (Rate ${index + 1}/${parts})` : purchase.label,
    source: "scenario" as const,
    refId: null,
  }));
}

export function checkAffordability(
  input: Omit<ForecastInput, "horizonDays" | "extraEvents">,
  purchase: Purchase,
  reserveCents: number,
  goals: GoalInput[],
  horizonDays = 90,
): AffordabilityResult {
  // Ein Jahr rechnen, damit Ueberschuss und Erholung belastbar sind
  const span = Math.max(365, horizonDays);
  const base = buildForecast({ ...input, horizonDays: span });
  const withPurchase = buildForecast({
    ...input,
    horizonDays: span,
    extraEvents: purchaseEvents(purchase),
  });

  const offset = Math.max(0, daysBetween(input.today, purchase.date));
  const windowEnd = Math.max(horizonDays, offset + 30);

  const snapshot = (forecast: typeof base): Snapshot => ({
    onDateCents: balanceAt(forecast, offset),
    in30Cents: balanceAt(forecast, 30),
    in90Cents: balanceAt(forecast, 90),
    lowest: lowestPoint(forecast, windowEnd),
  });

  const before = snapshot(base);
  const after = snapshot(withPurchase);

  const headroomCents = Math.max(0, before.lowest.balanceCents - reserveCents);
  const gapCents = Math.max(0, purchase.amountCents - headroomCents);

  const breachDay = firstDayBelow(withPurchase, reserveCents, windowEnd);
  const overdraftDay = firstDayBelow(withPurchase, 0, windowEnd);

  let verdict: AffordabilityVerdict;
  if (overdraftDay) verdict = "not-affordable";
  else if (breachDay) verdict = "tight";
  else if (after.lowest.balanceCents - reserveCents >= purchase.amountCents * 0.5) verdict = "comfortable";
  else verdict = "possible";

  // Ueberschuss: Veraenderung ueber das Jahr ohne Kauf, auf den Monat gerechnet
  const monthlySurplusCents = Math.round(
    (base.days[base.days.length - 1].balanceCents - base.openingBalanceCents) / (span / 30.44),
  );

  const recoveryMonths =
    monthlySurplusCents > 0 ? Math.ceil(purchase.amountCents / monthlySurplusCents) : null;

  const goalImpacts = goals
    .filter((goal) => (goal.monthlyContributionCents ?? 0) > 0 && goal.savedCents < goal.targetCents)
    .map((goal) => ({
      goalId: goal.id,
      title: goal.title,
      // Fehlt Geld fuer die Reserve, muesste es aus den Sparraten kommen
      delayMonths: delayInMonths(gapCents, goal.monthlyContributionCents),
    }));

  return {
    verdict,
    purchase,
    before,
    after,
    headroomCents,
    gapCents,
    reserveCents,
    reserveBreach: breachDay ? { date: breachDay.date, balanceCents: breachDay.balanceCents } : null,
    overdraft: overdraftDay ? { date: overdraftDay.date, balanceCents: overdraftDay.balanceCents } : null,
    monthlySurplusCents,
    recovery:
      recoveryMonths !== null
        ? { months: recoveryMonths, month: addMonths(purchase.date, recoveryMonths).slice(0, 7) }
        : null,
    goalImpacts,
    horizonDays: windowEnd,
  };
}
