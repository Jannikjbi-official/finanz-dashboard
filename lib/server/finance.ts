import "server-only";
import {
  accounts,
  categories,
  ensureIndexes,
  goals,
  planned,
  recurring,
  transactions,
} from "../mongo";
import { getSettings } from "./user-data";
import {
  addMonths,
  monthEnd,
  monthOf,
  monthStart,
  monthsUntil,
  todayIn,
  type ISODate,
  type MonthKey,
} from "../domain/calendar";
import {
  buildForecast,
  type ForecastInput,
  type GoalInput,
  type PlannedInput,
  type RecurringInput,
} from "../domain/forecast";
import { monthlyAmount } from "../domain/schedule";
import { evaluateSafety, resolveReserve } from "../domain/safety";
import { formatDayShort, formatMoney } from "../format";

/** Umbuchungen bewegen nur Geld zwischen eigenen Konten. */
const NO_TRANSFER = { transferGroupId: null };

/** Zahl der Vormonate fuer Durchschnittswerte. */
export const AVERAGE_MONTHS = 3;

export type AccountBalance = {
  id: string;
  name: string;
  kind: "giro" | "cash" | "savings" | "other";
  color: string;
  liquid: boolean;
  archived: boolean;
  balanceCents: number;
  /** Inklusive Buchungen mit Datum in der Zukunft. */
  scheduledBalanceCents: number;
  transactionCount: number;
};

/**
 * Kontostaende zu einem Stichtag. Ohne Stichtag: heute. Buchungen nach dem
 * Stichtag zaehlen nicht - damit funktioniert auch die Zeitreise.
 */
export async function getAccountBalances(userId: string, asOf: ISODate): Promise<AccountBalance[]> {
  await ensureIndexes();

  const [docs, sums] = await Promise.all([
    accounts.find({ userId }).sort({ createdAt: 1 }).toArray(),
    transactions
      .aggregate<{ _id: string; untilDate: number; all: number; count: number }>([
        { $match: { userId, accountId: { $nin: [null, ""] } } },
        {
          $project: {
            accountId: 1,
            signed: { $cond: [{ $eq: ["$type", "income"] }, "$amountCents", { $multiply: ["$amountCents", -1] }] },
            due: { $lte: ["$date", asOf] },
          },
        },
        {
          $group: {
            _id: "$accountId",
            untilDate: { $sum: { $cond: ["$due", "$signed", 0] } },
            all: { $sum: "$signed" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  const byId = new Map(sums.map((row) => [row._id, row]));

  return docs.map((doc) => {
    const id = doc._id.toString();
    const row = byId.get(id);
    return {
      id,
      name: doc.name,
      kind: doc.kind,
      color: doc.color,
      liquid: doc.liquid ?? doc.kind !== "savings",
      archived: doc.archived,
      balanceCents: doc.startBalanceCents + (row?.untilDate ?? 0),
      scheduledBalanceCents: doc.startBalanceCents + (row?.all ?? 0),
      transactionCount: row?.count ?? 0,
    };
  });
}

/** Summe aller Buchungen bis zum Stichtag - Ersatz, solange es keine Konten gibt. */
async function ledgerBalance(userId: string, asOf: ISODate) {
  const rows = await transactions
    .aggregate<{ _id: "income" | "expense"; sum: number }>([
      { $match: { userId, ...NO_TRANSFER, date: { $lte: asOf } } },
      { $group: { _id: "$type", sum: { $sum: "$amountCents" } } },
    ])
    .toArray();
  const totals = { income: 0, expense: 0 };
  for (const row of rows) totals[row._id] = row.sum;
  return totals.income - totals.expense;
}

/**
 * Variable Ausgaben: alles, was nicht aus einem Abo stammt und keine
 * Umbuchung ist. Durchschnitt der letzten vollen Monate mit Buchungen.
 */
async function variableSpending(userId: string, today: ISODate) {
  const currentMonth = monthOf(today);
  const history = monthsUntil(currentMonth, AVERAGE_MONTHS + 1).slice(0, -1);

  const rows = await transactions
    .aggregate<{ _id: string; sum: number }>([
      {
        $match: {
          userId,
          ...NO_TRANSFER,
          type: "expense",
          recurringId: null,
          date: { $gte: monthStart(history[0]), $lte: today },
        },
      },
      { $group: { _id: { $substrBytes: ["$date", 0, 7] }, sum: { $sum: "$amountCents" } } },
    ])
    .toArray();

  const byMonth = new Map(rows.map((row) => [row._id, row.sum]));
  const past = history.map((month) => byMonth.get(month) ?? 0).filter((sum) => sum > 0);

  return {
    monthlyCents: past.length > 0 ? Math.round(past.reduce((a, b) => a + b, 0) / past.length) : 0,
    basisMonths: past.length,
    spentThisMonthCents: byMonth.get(currentMonth) ?? 0,
  };
}

export type FinancialPicture = Awaited<ReturnType<typeof loadFinancialPicture>>;

/**
 * Das komplette Bild fuer die Zukunftsfunktionen eines Nutzers: Konten,
 * Fixkosten, Geplantes, Ziele, Prognose und Sicherheitszone.
 */
export async function loadFinancialPicture(userId: string, options: { horizonDays?: number } = {}) {
  await ensureIndexes();

  const userSettings = await getSettings(userId);
  const today = todayIn(userSettings.timeZone);

  const [balances, recurringDocs, plannedDocs, goalDocs, variable, categoryDocs] = await Promise.all([
    getAccountBalances(userId, today),
    recurring.find({ userId }).toArray(),
    planned.find({ userId, status: "open" }).toArray(),
    goals.find({ userId }).sort({ createdAt: 1 }).toArray(),
    variableSpending(userId, today),
    categories.find({ userId }).toArray(),
  ]);

  const activeAccounts = balances.filter((account) => !account.archived);
  const liquidAccounts = activeAccounts.filter((account) => account.liquid);
  const usesAccounts = activeAccounts.length > 0;

  const openingBalanceCents = usesAccounts
    ? liquidAccounts.reduce((sum, account) => sum + account.balanceCents, 0)
    : await ledgerBalance(userId, today);

  const recurringInput: RecurringInput[] = recurringDocs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    kind: doc.type,
    amountCents: doc.amountCents,
    interval: doc.interval,
    startDate: doc.startDate,
    nextDue: doc.nextDue,
    active: doc.active,
  }));

  const plannedInput: PlannedInput[] = plannedDocs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    kind: doc.kind,
    amountCents: doc.amountCents,
    dateFrom: doc.dateFrom,
    dateTo: doc.dateTo,
    certainty: doc.certainty,
  }));

  const goalInput: GoalInput[] = goalDocs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    monthlyContributionCents: doc.monthlyContributionCents ?? null,
    targetCents: doc.targetCents,
    savedCents: doc.savedCents,
  }));

  const active = recurringInput.filter((entry) => entry.active);
  const monthlyFixedCents = active
    .filter((entry) => entry.kind === "expense")
    .reduce((sum, entry) => sum + monthlyAmount(entry.amountCents, entry.interval), 0);
  const monthlyIncomeCents = active
    .filter((entry) => entry.kind === "income")
    .reduce((sum, entry) => sum + monthlyAmount(entry.amountCents, entry.interval), 0);
  const monthlyGoalCents = goalInput.reduce(
    (sum, goal) => sum + (goal.savedCents < goal.targetCents ? (goal.monthlyContributionCents ?? 0) : 0),
    0,
  );

  const forecastInput: Omit<ForecastInput, "horizonDays" | "extraEvents"> = {
    today,
    openingBalanceCents,
    recurring: recurringInput,
    planned: plannedInput,
    goals: goalInput,
    variableMonthlyCents: variable.monthlyCents,
    variableSpentThisMonthCents: variable.spentThisMonthCents,
  };

  const forecast = buildForecast({ ...forecastInput, horizonDays: options.horizonDays ?? 90 });
  const reserve = resolveReserve(userSettings.reserveCents, monthlyFixedCents);
  const safety = evaluateSafety(forecast, reserve, (cents) => formatMoney(cents), formatDayShort);

  return {
    today,
    settings: userSettings,
    accounts: balances,
    usesAccounts,
    openingBalanceCents,
    monthly: {
      fixedCents: monthlyFixedCents,
      incomeCents: monthlyIncomeCents,
      goalCents: monthlyGoalCents,
      variableCents: variable.monthlyCents,
      variableBasisMonths: variable.basisMonths,
      variableSpentThisMonthCents: variable.spentThisMonthCents,
    },
    recurring: recurringInput,
    planned: plannedInput,
    goals: goalInput,
    goalDocs,
    categories: categoryDocs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      kind: doc.kind,
      color: doc.color,
      icon: doc.icon,
      budgetCents: doc.budgetCents ?? null,
    })),
    forecastInput,
    forecast,
    reserve,
    safety,
  };
}

/* --------------------------------- Monate --------------------------------- */

export type MonthFlow = { month: MonthKey; incomeCents: number; expenseCents: number };

/** Einnahmen und Ausgaben je Monat (ohne Umbuchungen). */
export async function getMonthFlows(userId: string, from: MonthKey, to: MonthKey): Promise<MonthFlow[]> {
  const rows = await transactions
    .aggregate<{ _id: { month: string; type: "income" | "expense" }; sum: number }>([
      { $match: { userId, ...NO_TRANSFER, date: { $gte: monthStart(from), $lte: monthEnd(to) } } },
      {
        $group: {
          _id: { month: { $substrBytes: ["$date", 0, 7] }, type: "$type" },
          sum: { $sum: "$amountCents" },
        },
      },
    ])
    .toArray();

  const months: MonthFlow[] = [];
  for (let month = from; month <= to; month = monthOf(addMonths(`${month}-01`, 1))) {
    months.push({ month, incomeCents: 0, expenseCents: 0 });
  }
  const byMonth = new Map(months.map((entry) => [entry.month, entry]));
  for (const row of rows) {
    const entry = byMonth.get(row._id.month);
    if (!entry) continue;
    if (row._id.type === "income") entry.incomeCents = row.sum;
    else entry.expenseCents = row.sum;
  }
  return months;
}

/** Ausgaben je Kategorie und Monat - Basis fuer Budgets, Auffaelligkeiten und Bericht. */
export async function getCategoryMonths(userId: string, from: MonthKey, to: MonthKey, kind: "income" | "expense" = "expense") {
  return transactions
    .aggregate<{ _id: { month: string; categoryId: string | null }; sum: number; count: number }>([
      { $match: { userId, ...NO_TRANSFER, type: kind, date: { $gte: monthStart(from), $lte: monthEnd(to) } } },
      {
        $group: {
          _id: { month: { $substrBytes: ["$date", 0, 7] }, categoryId: "$categoryId" },
          sum: { $sum: "$amountCents" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray()
    .then((rows) =>
      rows.map((row) => ({
        month: row._id.month,
        categoryId: row._id.categoryId ?? null,
        sumCents: row.sum,
        count: row.count,
      })),
    );
}
