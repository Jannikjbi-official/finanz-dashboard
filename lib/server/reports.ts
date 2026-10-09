import "server-only";
import { categories, transactions } from "../mongo";
import { addDays, monthEnd, monthStart, monthsUntil, shiftMonth, type ISODate, type MonthKey } from "../domain/calendar";
import { findAnomalies, savingsRate, changeRatio } from "../domain/insights";
import { getAccountBalances, getCategoryMonths, getMonthFlows, AVERAGE_MONTHS } from "./finance";

const NO_TRANSFER = { transferGroupId: null };

export type CategoryLine = {
  categoryId: string | null;
  name: string;
  color: string;
  cents: number;
  share: number;
  averageCents: number;
  change: number | null;
};

async function categoryInfo(userId: string) {
  const docs = await categories.find({ userId }).toArray();
  return new Map(docs.map((doc) => [doc._id.toString(), { name: doc.name, color: doc.color }]));
}

function categoryName(info: Map<string, { name: string; color: string }>, id: string | null) {
  if (!id) return { name: "Ohne Kategorie", color: "#8a8d92" };
  return info.get(id) ?? { name: "Gelöschte Kategorie", color: "#8a8d92" };
}

/** Alles fuer den Monatsbericht eines Monats. */
export async function getMonthReport(userId: string, month: MonthKey, today: ISODate) {
  const previous = shiftMonth(month, -1);
  const history = monthsUntil(month, AVERAGE_MONTHS + 1);
  const start = monthStart(month);
  const end = monthEnd(month);

  const [flows, catRows, incomeRows, info, biggest, fixedBooked, balancesStart, balancesEnd] = await Promise.all([
    getMonthFlows(userId, previous, month),
    getCategoryMonths(userId, history[0], month, "expense"),
    getCategoryMonths(userId, month, month, "income"),
    categoryInfo(userId),
    transactions
      .find({ userId, ...NO_TRANSFER, type: "expense", date: { $gte: start, $lte: end } })
      .sort({ amountCents: -1 })
      .limit(5)
      .toArray(),
    transactions
      .aggregate<{ _id: null; sum: number; count: number }>([
        { $match: { userId, ...NO_TRANSFER, type: "expense", recurringId: { $nin: [null] }, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, sum: { $sum: "$amountCents" }, count: { $sum: 1 } } },
      ])
      .toArray(),
    getAccountBalances(userId, addDays(start, -1)),
    getAccountBalances(userId, end < today ? end : today),
  ]);

  const [prev, current] = flows;
  const netCents = current.incomeCents - current.expenseCents;

  const forMonth = catRows.filter((row) => row.month === month);
  const ids = new Set(catRows.map((row) => row.categoryId));
  const lines: CategoryLine[] = [...ids]
    .map((id) => {
      const rows = catRows.filter((row) => row.categoryId === id);
      const cents = rows.find((row) => row.month === month)?.sumCents ?? 0;
      const previousValues = history.slice(0, -1).map((m) => rows.find((row) => row.month === m)?.sumCents ?? 0);
      const averageCents = Math.round(previousValues.reduce((a, b) => a + b, 0) / previousValues.length);
      return {
        categoryId: id,
        ...categoryName(info, id),
        cents,
        share: current.expenseCents > 0 ? cents / current.expenseCents : 0,
        averageCents,
        change: changeRatio(cents, averageCents),
      };
    })
    .filter((line) => line.cents > 0)
    .sort((a, b) => b.cents - a.cents);

  const anomalies = findAnomalies(
    [...ids].map((id) => {
      const rows = catRows.filter((row) => row.categoryId === id);
      return {
        categoryId: id,
        name: categoryName(info, id).name,
        currentCents: rows.find((row) => row.month === month)?.sumCents ?? 0,
        previousCents: history
          .slice(0, -1)
          .map((m) => rows.find((row) => row.month === m)?.sumCents ?? 0)
          .filter((v) => v > 0),
      };
    }),
    month,
    today,
  );

  const sumBalances = (list: typeof balancesEnd) => list.filter((a) => !a.archived).reduce((s, a) => s + a.balanceCents, 0);

  return {
    month,
    complete: end < today,
    incomeCents: current.incomeCents,
    expenseCents: current.expenseCents,
    netCents,
    savingsRate: savingsRate(current.incomeCents, current.expenseCents),
    previous: {
      incomeCents: prev.incomeCents,
      expenseCents: prev.expenseCents,
      netCents: prev.incomeCents - prev.expenseCents,
      savingsRate: savingsRate(prev.incomeCents, prev.expenseCents),
    },
    categories: lines,
    incomeSources: incomeRows
      .map((row) => ({ ...categoryName(info, row.categoryId), cents: row.sumCents }))
      .sort((a, b) => b.cents - a.cents),
    anomalies: anomalies.slice(0, 4),
    biggest: biggest.map((doc) => ({ id: doc._id.toString(), title: doc.title, date: doc.date, cents: doc.amountCents })),
    fixedBookedCents: fixedBooked[0]?.sum ?? 0,
    transactionCount: [...forMonth, ...incomeRows].reduce((s, row) => s + row.count, 0),
    wealth: balancesEnd.length > 0 ? { startCents: sumBalances(balancesStart), endCents: sumBalances(balancesEnd) } : null,
  };
}

/** 12-Monats-Verlauf und Kategorien je Monat fuer die Analysen. */
export async function getAnalysis(userId: string, until: MonthKey, months = 12) {
  const range = monthsUntil(until, months);
  const [flows, catRows, info] = await Promise.all([
    getMonthFlows(userId, range[0], until),
    getCategoryMonths(userId, range[range.length - 6], until, "expense"),
    categoryInfo(userId),
  ]);

  const recent = range.slice(-6);
  const ids = new Set(catRows.map((row) => row.categoryId));
  const categoriesByMonth = [...ids]
    .map((id) => {
      const values = recent.map((m) => catRows.find((row) => row.categoryId === id && row.month === m)?.sumCents ?? 0);
      const total = values.reduce((a, b) => a + b, 0);
      const firstHalf = values.slice(0, 3).reduce((a, b) => a + b, 0);
      const secondHalf = values.slice(3).reduce((a, b) => a + b, 0);
      return { categoryId: id, ...categoryName(info, id), values, total, average: Math.round(total / values.length), trend: changeRatio(secondHalf, firstHalf) };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    months: flows.map((flow) => ({ ...flow, netCents: flow.incomeCents - flow.expenseCents, savingsRate: savingsRate(flow.incomeCents, flow.expenseCents) })),
    recentMonths: recent,
    categories: categoriesByMonth,
  };
}
