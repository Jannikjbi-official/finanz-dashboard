import "server-only";
import type { WithId } from "mongodb";
import {
  categories,
  ensureIndexes,
  recurring,
  transactions,
  type CategoryDoc,
  type RecurringDoc,
  type TransactionDoc,
} from "./mongo";
import type { Category, Recurring, Transaction } from "./types";
import { currentMonthKey, lastMonthKeys, monthRange, monthlyAmount } from "./dates";

function mapCategory(doc: WithId<CategoryDoc>): Category {
  return {
    id: doc._id.toString(),
    name: doc.name,
    kind: doc.kind,
    color: doc.color,
    icon: doc.icon,
    budgetCents: doc.budgetCents ?? null,
  };
}

function mapTransaction(doc: WithId<TransactionDoc>): Transaction {
  return {
    id: doc._id.toString(),
    type: doc.type,
    amountCents: doc.amountCents,
    title: doc.title,
    note: doc.note ?? null,
    date: doc.date,
    categoryId: doc.categoryId ?? null,
    recurringId: doc.recurringId ?? null,
  };
}

function mapRecurring(doc: WithId<RecurringDoc>): Recurring {
  return {
    id: doc._id.toString(),
    type: doc.type,
    amountCents: doc.amountCents,
    title: doc.title,
    interval: doc.interval,
    categoryId: doc.categoryId ?? null,
    startDate: doc.startDate,
    nextDue: doc.nextDue,
    active: doc.active,
    note: doc.note ?? null,
  };
}

export async function getCategories(userId: string): Promise<Category[]> {
  await ensureIndexes();
  const docs = await categories
    .find({ userId })
    .sort({ kind: 1, name: 1 })
    .toArray();
  return docs.map(mapCategory);
}

export async function getTransactions(
  userId: string,
  options: { month?: string; limit?: number } = {},
): Promise<Transaction[]> {
  const filter: Record<string, unknown> = { userId };

  if (options.month) {
    const { start, end } = monthRange(options.month);
    filter.date = { $gte: start, $lte: end };
  }

  const cursor = transactions.find(filter).sort({ date: -1, createdAt: -1 });
  if (options.limit) cursor.limit(options.limit);

  return (await cursor.toArray()).map(mapTransaction);
}

export async function getRecurring(userId: string): Promise<Recurring[]> {
  const docs = await recurring
    .find({ userId })
    .sort({ active: -1, nextDue: 1 })
    .toArray();
  return docs.map(mapRecurring);
}

type Totals = { income: number; expense: number };

async function totalsForRange(userId: string, start: string, end: string) {
  const rows = await transactions
    .aggregate<{ _id: "income" | "expense"; sum: number }>([
      { $match: { userId, date: { $gte: start, $lte: end } } },
      { $group: { _id: "$type", sum: { $sum: "$amountCents" } } },
    ])
    .toArray();

  const totals: Totals = { income: 0, expense: 0 };
  for (const row of rows) totals[row._id] = row.sum;
  return totals;
}

export type CategorySlice = {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  amountCents: number;
  budgetCents: number | null;
};

export type DashboardData = {
  month: string;
  monthTotals: Totals;
  previousTotals: Totals;
  allTime: Totals;
  expenseByCategory: CategorySlice[];
  incomeByCategory: CategorySlice[];
  trend: Array<{ month: string; income: number; expense: number }>;
  recurringMonthlyExpense: number;
  recurringMonthlyIncome: number;
  activeSubscriptions: number;
  upcoming: Recurring[];
  recent: Transaction[];
  categories: Category[];
};

export async function getDashboard(
  userId: string,
  month = currentMonthKey(),
): Promise<DashboardData> {
  await ensureIndexes();

  const range = monthRange(month);
  const previous = monthRange(
    lastMonthKeys(2, month)[0],
  );

  const [cats, monthTotals, previousTotals, allRows, monthTx, recurringList] =
    await Promise.all([
      getCategories(userId),
      totalsForRange(userId, range.start, range.end),
      totalsForRange(userId, previous.start, previous.end),
      transactions
        .aggregate<{ _id: "income" | "expense"; sum: number }>([
          { $match: { userId } },
          { $group: { _id: "$type", sum: { $sum: "$amountCents" } } },
        ])
        .toArray(),
      getTransactions(userId, { month }),
      getRecurring(userId),
    ]);

  const allTime: Totals = { income: 0, expense: 0 };
  for (const row of allRows) allTime[row._id] = row.sum;

  const catById = new Map(cats.map((category) => [category.id, category]));

  function sliceBy(kind: "income" | "expense"): CategorySlice[] {
    const buckets = new Map<string | null, number>();

    for (const tx of monthTx) {
      if (tx.type !== kind) continue;
      const key = tx.categoryId ?? null;
      buckets.set(key, (buckets.get(key) ?? 0) + tx.amountCents);
    }

    return [...buckets.entries()]
      .map(([categoryId, amountCents]) => {
        const category = categoryId ? catById.get(categoryId) : undefined;
        return {
          categoryId,
          name: category?.name ?? "Ohne Kategorie",
          color: category?.color ?? "#64748b",
          icon: category?.icon ?? "",
          amountCents,
          budgetCents: category?.budgetCents ?? null,
        };
      })
      .sort((a, b) => b.amountCents - a.amountCents);
  }

  const trendMonths = lastMonthKeys(6, month);
  const trend = await Promise.all(
    trendMonths.map(async (key) => {
      const { start, end } = monthRange(key);
      const totals = await totalsForRange(userId, start, end);
      return { month: key, income: totals.income, expense: totals.expense };
    }),
  );

  const active = recurringList.filter((entry) => entry.active);

  return {
    month,
    monthTotals,
    previousTotals,
    allTime,
    expenseByCategory: sliceBy("expense"),
    incomeByCategory: sliceBy("income"),
    trend,
    recurringMonthlyExpense: active
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + monthlyAmount(entry.amountCents, entry.interval), 0),
    recurringMonthlyIncome: active
      .filter((entry) => entry.type === "income")
      .reduce((sum, entry) => sum + monthlyAmount(entry.amountCents, entry.interval), 0),
    activeSubscriptions: active.filter((entry) => entry.type === "expense").length,
    upcoming: [...active].sort((a, b) => a.nextDue.localeCompare(b.nextDue)).slice(0, 5),
    recent: monthTx.slice(0, 8),
    categories: cats,
  };
}
