import "server-only";
import { transactions } from "../mongo";
import { monthOf, monthsUntil } from "../domain/calendar";
import { projectBudget } from "../domain/budgets";
import { findAnomalies } from "../domain/insights";
import { goalState } from "../domain/goals";
import { formatDayShort, formatMoney, formatMonth, formatPercent } from "../format";
import { AVERAGE_MONTHS, getCategoryMonths, type FinancialPicture } from "./finance";

export type Insight = {
  id: string;
  tone: "neg" | "caution" | "warn" | "info" | "pos";
  title: string;
  detail: string;
  href?: string;
  action?: string;
};

const ORDER: Record<Insight["tone"], number> = { neg: 0, caution: 1, warn: 2, info: 3, pos: 4 };

/**
 * "Was sollte ich wissen?" - jede Aussage mit den Zahlen, aus denen sie
 * folgt, und einem Weg, etwas zu tun.
 */
export async function buildInsights(userId: string, picture: FinancialPicture): Promise<Insight[]> {
  const { today } = picture;
  const month = monthOf(today);
  const history = monthsUntil(month, AVERAGE_MONTHS + 1);
  const insights: Insight[] = [];

  const [categoryMonths, unassigned] = await Promise.all([
    getCategoryMonths(userId, history[0], month),
    picture.usesAccounts
      ? transactions.countDocuments({ userId, $or: [{ accountId: null }, { accountId: { $exists: false } }] })
      : Promise.resolve(0),
  ]);

  const nameOf = new Map(picture.categories.map((c) => [c.id, c.name]));

  /* -------------------------------- Budgets ------------------------------- */
  for (const category of picture.categories) {
    if (category.kind !== "expense" || !category.budgetCents) continue;
    const rows = categoryMonths.filter((row) => row.categoryId === category.id);
    const spent = rows.find((row) => row.month === month)?.sumCents ?? 0;
    const previous = history.slice(0, -1).map((m) => rows.find((row) => row.month === m)?.sumCents ?? 0);
    const average = Math.round(previous.reduce((a, b) => a + b, 0) / previous.length);
    const projection = projectBudget({ budgetCents: category.budgetCents, spentCents: spent, averageCents: average }, month, today);

    if (projection.status === "over") {
      insights.push({
        id: `budget-over-${category.id}`,
        tone: "caution",
        title: `Budget ${category.name} überschritten`,
        detail: `${formatMoney(spent)} von ${formatMoney(category.budgetCents)} ausgegeben – ${formatMoney(spent - category.budgetCents)} darüber.`,
        href: "/app/planung/budgets",
      });
    } else if (projection.status === "projected-over") {
      insights.push({
        id: `budget-pace-${category.id}`,
        tone: "warn",
        title: `${category.name}: Budget wird knapp`,
        detail: `Bisher ${formatMoney(spent)}; im aktuellen Tempo etwa ${formatMoney(projection.projectedCents, { whole: true })} bis Monatsende bei ${formatMoney(category.budgetCents, { whole: true })} Budget.`,
        href: "/app/planung/budgets",
      });
    }
  }

  /* ---------------------------- Auffaelligkeiten --------------------------- */
  const ids = new Set(categoryMonths.map((row) => row.categoryId));
  const anomalies = findAnomalies(
    [...ids].map((categoryId) => {
      const rows = categoryMonths.filter((row) => row.categoryId === categoryId);
      return {
        categoryId,
        name: categoryId ? (nameOf.get(categoryId) ?? "Gelöschte Kategorie") : "Ohne Kategorie",
        currentCents: rows.find((row) => row.month === month)?.sumCents ?? 0,
        previousCents: history
          .slice(0, -1)
          .map((m) => rows.find((row) => row.month === m)?.sumCents ?? 0)
          .filter((value) => value > 0),
      };
    }),
    month,
    today,
  );

  for (const anomaly of anomalies.slice(0, 3)) {
    if (anomaly.direction === "lower") continue;
    insights.push({
      id: `anomaly-${anomaly.categoryId ?? "none"}`,
      tone: "info",
      title:
        anomaly.direction === "new"
          ? `Neu: ${anomaly.name}`
          : `${anomaly.name} liegt ${formatPercent(anomaly.changeRatio)} über deinem Durchschnitt`,
      detail:
        anomaly.direction === "new"
          ? `${formatMoney(anomaly.currentCents)} in ${formatMonth(month)}, in den Vormonaten nichts.`
          : `${formatMoney(anomaly.currentCents)} bis heute; üblich wären bis jetzt etwa ${formatMoney(anomaly.expectedCents, { whole: true })} (Ø ${anomaly.basisMonths} Monate: ${formatMoney(anomaly.averageCents, { whole: true })}/Monat).`,
      href: `/app/geld/buchungen?kategorie=${anomaly.categoryId ?? "none"}`,
    });
  }

  /* --------------------------------- Ziele -------------------------------- */
  for (const goal of picture.goalDocs) {
    const state = goalState(
      {
        targetCents: goal.targetCents,
        savedCents: goal.savedCents,
        deadline: goal.deadline,
        monthlyContributionCents: goal.monthlyContributionCents ?? null,
      },
      today,
    );
    if (state.status === "behind" && state.requiredMonthlyCents !== null) {
      insights.push({
        id: `goal-${goal._id}`,
        tone: "warn",
        title: `Ziel „${goal.title}“ hinkt hinterher`,
        detail: `Mit ${formatMoney(goal.monthlyContributionCents ?? 0, { whole: true })}/Monat erreicht bis ${state.expectedMonth ? formatMonth(state.expectedMonth) : "–"}; für die Frist wären ${formatMoney(state.requiredMonthlyCents, { whole: true })}/Monat nötig.`,
        href: "/app/planung/ziele",
      });
    }
    if (state.status === "overdue") {
      insights.push({
        id: `goal-overdue-${goal._id}`,
        tone: "info",
        title: `Frist für „${goal.title}“ ist verstrichen`,
        detail: `Es fehlen noch ${formatMoney(state.remainingCents)}. Neue Frist setzen oder Ziel anpassen.`,
        href: "/app/planung/ziele",
      });
    }
  }

  /* --------------------------- Offenes & Luecken --------------------------- */
  const overdue = picture.forecast.events.filter((event) => event.overdue);
  if (overdue.length > 0) {
    insights.push({
      id: "overdue",
      tone: "info",
      title: overdue.length === 1 ? `„${overdue[0].label}“ ist fällig` : `${overdue.length} Zahlungen sind fällig`,
      detail: `Noch nicht als Buchung erfasst – die Prognose rechnet sie für heute ein (${formatMoney(overdue.reduce((s, e) => s + e.amountCents, 0), { signed: true })}).`,
      href: "/app/planung/fixkosten",
      action: "Ansehen",
    });
  }

  if (picture.forecast.undated.length > 0) {
    const income = picture.forecast.undated.filter((item) => item.kind === "income");
    if (income.length > 0) {
      insights.push({
        id: "undated",
        tone: "info",
        title: `${formatMoney(income.reduce((s, i) => s + i.amountCents, 0))} erwartet, Termin offen`,
        detail: "Einnahmen ohne Termin zählen in der Prognose vorsichtshalber nicht mit.",
        href: "/app/planung/geplant",
      });
    }
  }

  if (!picture.recurring.some((entry) => entry.active && entry.kind === "income")) {
    insights.push({
      id: "no-income",
      tone: "info",
      title: "Kein regelmäßiges Einkommen hinterlegt",
      detail: "Ohne Gehalt oder andere feste Eingänge kennt die Prognose nur Ausgaben und zeigt die Zukunft zu düster.",
      href: "/app/planung/fixkosten",
      action: "Einkommen eintragen",
    });
  }

  if (unassigned > 0) {
    insights.push({
      id: "unassigned",
      tone: "info",
      title: `${unassigned} Buchungen ohne Konto`,
      detail: "Sie fehlen im Kontostand und damit in der Prognose.",
      href: "/app/geld/buchungen?konto=none",
    });
  }

  const nextIncome = picture.forecast.events.find((event) => event.amountCents > 0 && event.source === "recurring");
  if (insights.length === 0 && nextIncome) {
    insights.push({
      id: "calm",
      tone: "pos",
      title: "Nichts Auffälliges",
      detail: `Budgets im Rahmen, keine Ausreißer. Nächster Eingang: ${nextIncome.label} am ${formatDayShort(nextIncome.date)}.`,
    });
  }

  return insights.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}

