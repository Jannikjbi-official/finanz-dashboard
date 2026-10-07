import { addMonths, daysBetween, monthOf, type ISODate } from "./calendar";

export type GoalState = {
  remainingCents: number;
  progress: number; // 0..1
  reached: boolean;
  /** Bei aktueller Rate erreicht im Monat ... (null = ohne Rate nie). */
  expectedMonth: string | null;
  /** Noetige Rate pro Monat, um die Deadline zu halten. */
  requiredMonthlyCents: number | null;
  monthsLeft: number | null;
  status: "reached" | "on-track" | "behind" | "no-plan" | "overdue";
};

/**
 * Stand eines Sparziels. Raten werden ab dem naechsten Monat gerechnet - wie
 * in der Prognose.
 */
export function goalState(
  goal: {
    targetCents: number;
    savedCents: number;
    deadline: ISODate | null;
    monthlyContributionCents: number | null;
  },
  today: ISODate,
): GoalState {
  const remainingCents = Math.max(0, goal.targetCents - goal.savedCents);
  const progress = goal.targetCents > 0 ? Math.min(1, goal.savedCents / goal.targetCents) : 0;
  const rate = goal.monthlyContributionCents ?? 0;

  if (remainingCents === 0) {
    return {
      remainingCents, progress: 1, reached: true, expectedMonth: null,
      requiredMonthlyCents: null, monthsLeft: null, status: "reached",
    };
  }

  const monthsNeeded = rate > 0 ? Math.ceil(remainingCents / rate) : null;
  const expectedMonth =
    monthsNeeded !== null ? monthOf(addMonths(`${monthOf(today)}-01`, monthsNeeded)) : null;

  let monthsLeft: number | null = null;
  let requiredMonthlyCents: number | null = null;

  if (goal.deadline) {
    monthsLeft = monthsBetween(today, goal.deadline);
    requiredMonthlyCents = monthsLeft > 0 ? Math.ceil(remainingCents / monthsLeft) : remainingCents;
  }

  let status: GoalState["status"];
  if (goal.deadline && daysBetween(today, goal.deadline) < 0) status = "overdue";
  else if (monthsNeeded === null) status = "no-plan";
  else if (!goal.deadline || (expectedMonth !== null && expectedMonth <= monthOf(goal.deadline))) status = "on-track";
  else status = "behind";

  return {
    remainingCents, progress, reached: false, expectedMonth,
    requiredMonthlyCents, monthsLeft, status,
  };
}

/** Volle Monatsraten bis zur Deadline (erste Rate am naechsten Monatsersten). */
export function monthsBetween(today: ISODate, deadline: ISODate) {
  const [y1, m1] = today.split("-").map(Number);
  const [y2, m2] = deadline.split("-").map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1));
}

/** Um wie viele Monate verschiebt sich ein Ziel, wenn `gapCents` fehlen? */
export function delayInMonths(gapCents: number, monthlyContributionCents: number | null) {
  if (gapCents <= 0) return 0;
  if (!monthlyContributionCents || monthlyContributionCents <= 0) return null;
  return Math.ceil(gapCents / monthlyContributionCents);
}
