import type { ISODate } from "./calendar";
import { firstDayBelow, lowestPoint, type Forecast } from "./forecast";

/**
 * Sicherheitszone - eine nachvollziehbare Einordnung, keine Blackbox.
 *
 *   below     Das Guthaben liegt schon heute unter der Mindestreserve.
 *   critical  Es faellt in den naechsten 30 Tagen darunter.
 *   tight     Es faellt in 31-90 Tagen darunter, oder der tiefste Stand der
 *             naechsten 30 Tage liegt weniger als 20 % ueber der Reserve.
 *   stable    Nichts davon.
 *
 * Jede Einstufung kommt mit den Zahlen, aus denen sie folgt.
 */

export type SafetyLevel = "stable" | "tight" | "critical" | "below";

export const SAFETY_LABEL: Record<SafetyLevel, string> = {
  stable: "Stabil",
  tight: "Angespannt",
  critical: "Kritisch",
  below: "Unter Mindestreserve",
};

export const NEAR_WINDOW = 30;
export const FAR_WINDOW = 90;
/** Abstand zur Reserve, unter dem es als angespannt gilt. */
export const CUSHION_RATIO = 0.2;

export type ReserveSource = "custom" | "fixed-costs" | "none";

export type SafetyReport = {
  level: SafetyLevel;
  reserveCents: number;
  reserveSource: ReserveSource;
  currentCents: number;
  low30: { date: ISODate; balanceCents: number };
  low90: { date: ISODate; balanceCents: number };
  /** Erster Tag unter der Reserve, falls innerhalb von 90 Tagen. */
  breach: { date: ISODate; balanceCents: number } | null;
  /**
   * Spielraum: so viel kann heute ausgegeben werden, ohne dass der Stand in
   * den naechsten 90 Tagen unter die Reserve faellt.
   */
  headroomCents: number;
  reasons: string[];
};

/**
 * Mindestreserve: eigener Wert aus den Einstellungen, sonst automatisch ein
 * Monat Fixkosten.
 */
/** Satzende ohne doppelten Punkt ("am 31. Okt.." -> "am 31. Okt."). */
function sentence(text: string) {
  return text.replace(/..$/, ".");
}

export function resolveReserve(customCents: number | null, monthlyFixedCents: number) {
  if (customCents !== null && customCents >= 0) {
    return { reserveCents: customCents, reserveSource: "custom" as const };
  }
  if (monthlyFixedCents > 0) {
    return { reserveCents: monthlyFixedCents, reserveSource: "fixed-costs" as const };
  }
  return { reserveCents: 0, reserveSource: "none" as const };
}

export function evaluateSafety(
  forecast: Forecast,
  reserve: { reserveCents: number; reserveSource: ReserveSource },
  format: (cents: number) => string,
  formatDay: (date: ISODate) => string,
): SafetyReport {
  const { reserveCents } = reserve;
  const currentCents = forecast.days[0].balanceCents;
  const low30 = lowestPoint(forecast, NEAR_WINDOW);
  const low90 = lowestPoint(forecast, FAR_WINDOW);
  const breachDay = firstDayBelow(forecast, reserveCents, FAR_WINDOW);
  const breach = breachDay ? { date: breachDay.date, balanceCents: breachDay.balanceCents } : null;
  const headroomCents = Math.max(0, low90.balanceCents - reserveCents);
  const cushion = Math.round(reserveCents * CUSHION_RATIO);

  const reasons: string[] = [];
  const reserveText =
    reserve.reserveSource === "custom"
      ? `deiner Mindestreserve von ${format(reserveCents)}`
      : reserve.reserveSource === "fixed-costs"
        ? `der Mindestreserve von ${format(reserveCents)} (ein Monat Fixkosten)`
        : format(0);

  let level: SafetyLevel;

  if (forecast.openingBalanceCents < reserveCents) {
    level = "below";
    reasons.push(`Dein verfügbares Geld (${format(forecast.openingBalanceCents)}) liegt unter ${reserveText}.`);
  } else if (breach && breach.date <= forecast.days[NEAR_WINDOW]?.date) {
    level = "critical";
    reasons.push(
      `Am ${formatDay(breach.date)} fällt dein Stand voraussichtlich auf ${format(breach.balanceCents)} – unter ${reserveText}.`,
    );
  } else if (breach) {
    level = "tight";
    reasons.push(
      `In ${FAR_WINDOW} Tagen: Am ${formatDay(breach.date)} fällt dein Stand voraussichtlich unter ${reserveText}.`,
    );
  } else if (reserveCents > 0 && low30.balanceCents - reserveCents < cushion) {
    level = "tight";
    reasons.push(
      `Der tiefste Stand der nächsten ${NEAR_WINDOW} Tage (${format(low30.balanceCents)} am ${formatDay(low30.date)}) liegt nur ${format(low30.balanceCents - reserveCents)} über ${reserveText}.`,
    );
  } else {
    level = "stable";
    reasons.push(
      `In den nächsten ${FAR_WINDOW} Tagen bleibt dein Stand über ${reserveText}; der tiefste Punkt ist ${format(low90.balanceCents)} am ${formatDay(low90.date)}.`,
    );
  }

  if (reserve.reserveSource === "none") {
    reasons.push("Du hast keine Mindestreserve und keine Fixkosten hinterlegt – die Einstufung ist deshalb nur grob.");
  }

  return {
    level,
    ...reserve,
    reasons: reasons.map(sentence),
    currentCents,
    low30,
    low90,
    breach,
    headroomCents,
  };
}
