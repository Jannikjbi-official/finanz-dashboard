import "server-only";
import type { WithId } from "mongodb";
import {
  accounts,
  categories,
  ensureIndexes,
  goals,
  recurring,
  refunds,
  transactions,
  type CategoryDoc,
  type RecurringDoc,
  type TransactionDoc,
} from "./mongo";
import type { Account, Category, Goal, Recurring, Refund, Transaction } from "./types";
export type { Account, Goal, Refund } from "./types";
export { ACCOUNT_KIND_LABEL } from "./types";
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
    dateEnd: doc.dateEnd ?? null,
    datePrecision: doc.datePrecision ?? "day",
    categoryId: doc.categoryId ?? null,
    recurringId: doc.recurringId ?? null,
    accountId: doc.accountId ?? null,
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
  /** Feste Einnahmen werden auf dem Dashboard verwaltet, nicht unter Abos. */
  recurringIncome: Recurring[];
  /** Aktive Abos, die in diesem Monat noch faellig werden. */
  openRecurringCents: number;
  openRecurringCount: number;
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

  // Was in diesem Monat noch an festen Ausgaben ansteht
  const openRecurring = active.filter(
    (entry) =>
      entry.type === "expense" &&
      entry.nextDue >= range.start &&
      entry.nextDue <= range.end,
  );

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
    recurringIncome: recurringList.filter((entry) => entry.type === "income"),
    openRecurringCents: openRecurring.reduce(
      (sum, entry) => sum + entry.amountCents,
      0,
    ),
    openRecurringCount: openRecurring.length,
    upcoming: [...active]
      .filter((entry) => entry.type === "expense")
      .sort((a, b) => a.nextDue.localeCompare(b.nextDue))
      .slice(0, 5),
    recent: monthTx.slice(0, 8),
    categories: cats,
  };
}

/* ------------------------------ Auswertung ------------------------------- */

export type YearStats = {
  year: number;
  months: Array<{ month: string; income: number; expense: number }>;
  totals: { income: number; expense: number };
  best: { month: string; saldo: number } | null;
  worst: { month: string; saldo: number } | null;
  expenseByCategory: CategorySlice[];
  incomeByCategory: CategorySlice[];
  topExpenses: Transaction[];
  transactionCount: number;
  activeMonths: number;
};

export async function getYearStats(
  userId: string,
  year: number,
): Promise<YearStats> {
  await ensureIndexes();

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [cats, rows, topExpenses, transactionCount] = await Promise.all([
    getCategories(userId),
    transactions
      .aggregate<{
        _id: { month: string; type: "income" | "expense" };
        sum: number;
      }>([
        { $match: { userId, date: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { month: { $substrBytes: ["$date", 0, 7] }, type: "$type" },
            sum: { $sum: "$amountCents" },
          },
        },
      ])
      .toArray(),
    transactions
      .find({ userId, type: "expense", date: { $gte: start, $lte: end } })
      .sort({ amountCents: -1 })
      .limit(8)
      .toArray(),
    transactions.countDocuments({ userId, date: { $gte: start, $lte: end } }),
  ]);

  const monthMap = new Map<string, { income: number; expense: number }>();
  for (let index = 1; index <= 12; index += 1) {
    monthMap.set(`${year}-${`${index}`.padStart(2, "0")}`, {
      income: 0,
      expense: 0,
    });
  }
  for (const row of rows) {
    const bucket = monthMap.get(row._id.month);
    if (bucket) bucket[row._id.type] = row.sum;
  }

  const months = [...monthMap.entries()].map(([month, value]) => ({
    month,
    ...value,
  }));

  const totals = months.reduce(
    (acc, entry) => ({
      income: acc.income + entry.income,
      expense: acc.expense + entry.expense,
    }),
    { income: 0, expense: 0 },
  );

  const withData = months.filter(
    (entry) => entry.income > 0 || entry.expense > 0,
  );
  const ranked = [...withData].sort(
    (a, b) => b.income - b.expense - (a.income - a.expense),
  );

  // Kategorien ueber das ganze Jahr
  const catRows = await transactions
    .aggregate<{
      _id: { categoryId: string | null; type: "income" | "expense" };
      sum: number;
    }>([
      { $match: { userId, date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { categoryId: "$categoryId", type: "$type" },
          sum: { $sum: "$amountCents" },
        },
      },
    ])
    .toArray();

  const catById = new Map(cats.map((category) => [category.id, category]));

  function slicesFor(kind: "income" | "expense"): CategorySlice[] {
    return catRows
      .filter((row) => row._id.type === kind)
      .map((row) => {
        const category = row._id.categoryId
          ? catById.get(row._id.categoryId)
          : undefined;
        return {
          categoryId: row._id.categoryId ?? null,
          name: category?.name ?? "Ohne Kategorie",
          color: category?.color ?? "#64748b",
          icon: category?.icon ?? "",
          amountCents: row.sum,
          budgetCents: category?.budgetCents ?? null,
        };
      })
      .sort((a, b) => b.amountCents - a.amountCents);
  }

  return {
    year,
    months,
    totals,
    best: ranked[0]
      ? { month: ranked[0].month, saldo: ranked[0].income - ranked[0].expense }
      : null,
    worst: ranked.at(-1)
      ? {
          month: ranked.at(-1)!.month,
          saldo: ranked.at(-1)!.income - ranked.at(-1)!.expense,
        }
      : null,
    expenseByCategory: slicesFor("expense"),
    incomeByCategory: slicesFor("income"),
    topExpenses: topExpenses.map(mapTransaction),
    transactionCount,
    activeMonths: withData.length,
  };
}

/* --------------------------- Budgets & Sparziele --------------------------- */

export async function getGoals(userId: string): Promise<Goal[]> {
  await ensureIndexes();

  const docs = await goals.find({ userId }).sort({ createdAt: 1 }).toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    targetCents: doc.targetCents,
    savedCents: doc.savedCents,
    deadline: doc.deadline ?? null,
    color: doc.color,
    note: doc.note ?? null,
  }));
}

export type BudgetRow = {
  category: Category;
  spentCents: number;
  /** Durchschnitt der letzten drei Monate, als Orientierung. */
  averageCents: number;
};

export async function getBudgetOverview(
  userId: string,
  month = currentMonthKey(),
): Promise<BudgetRow[]> {
  await ensureIndexes();

  const cats = await getCategories(userId);
  const expenseCats = cats.filter((category) => category.kind === "expense");

  const range = monthRange(month);
  const threeMonths = lastMonthKeys(3, month);
  const historyStart = monthRange(threeMonths[0]).start;
  const historyEnd = monthRange(threeMonths[2]).end;

  const [current, history] = await Promise.all([
    transactions
      .aggregate<{ _id: string | null; sum: number }>([
        {
          $match: {
            userId,
            type: "expense",
            date: { $gte: range.start, $lte: range.end },
          },
        },
        { $group: { _id: "$categoryId", sum: { $sum: "$amountCents" } } },
      ])
      .toArray(),
    transactions
      .aggregate<{ _id: string | null; sum: number }>([
        {
          $match: {
            userId,
            type: "expense",
            date: { $gte: historyStart, $lte: historyEnd },
          },
        },
        { $group: { _id: "$categoryId", sum: { $sum: "$amountCents" } } },
      ])
      .toArray(),
  ]);

  const spent = new Map(current.map((row) => [row._id, row.sum]));
  const average = new Map(
    history.map((row) => [row._id, Math.round(row.sum / 3)]),
  );

  return expenseCats
    .map((category) => ({
      category,
      spentCents: spent.get(category.id) ?? 0,
      averageCents: average.get(category.id) ?? 0,
    }))
    .sort((a, b) => {
      // Kategorien mit Budget zuerst, dann nach Ausgaben
      const budgetDiff =
        Number(Boolean(b.category.budgetCents)) -
        Number(Boolean(a.category.budgetCents));
      if (budgetDiff !== 0) return budgetDiff;
      return b.spentCents - a.spentCents;
    });
}

/* --------------------------------- Konten --------------------------------- */

export async function getAccounts(userId: string): Promise<Account[]> {
  await ensureIndexes();

  const [docs, sums] = await Promise.all([
    accounts.find({ userId }).sort({ createdAt: 1 }).toArray(),
    transactions
      .aggregate<{
        _id: { accountId: string | null; type: "income" | "expense" };
        sum: number;
        count: number;
      }>([
        { $match: { userId, accountId: { $ne: null } } },
        {
          $group: {
            _id: { accountId: "$accountId", type: "$type" },
            sum: { $sum: "$amountCents" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  const movement = new Map<string, { delta: number; count: number }>();
  for (const row of sums) {
    if (!row._id.accountId) continue;
    const entry = movement.get(row._id.accountId) ?? { delta: 0, count: 0 };
    entry.delta += row._id.type === "income" ? row.sum : -row.sum;
    entry.count += row.count;
    movement.set(row._id.accountId, entry);
  }

  return docs.map((doc) => {
    const id = doc._id.toString();
    const entry = movement.get(id) ?? { delta: 0, count: 0 };

    return {
      id,
      name: doc.name,
      kind: doc.kind,
      startBalanceCents: doc.startBalanceCents,
      balanceCents: doc.startBalanceCents + entry.delta,
      color: doc.color,
      icon: doc.icon,
      archived: doc.archived,
      transactionCount: entry.count,
    };
  });
}

/** Buchungen ohne Kontozuordnung - fuer den Hinweis auf der Kontenseite. */
export async function countTransactionsWithoutAccount(userId: string) {
  return transactions.countDocuments({
    userId,
    $or: [{ accountId: null }, { accountId: { $exists: false } }],
  });
}

/* ------------------------------ Erstattungen ------------------------------ */

export async function getRefunds(userId: string): Promise<Refund[]> {
  await ensureIndexes();

  const docs = await refunds
    .find({ userId })
    .sort({ status: 1, createdAt: -1 })
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    amountCents: doc.amountCents,
    expectedFrom: doc.expectedFrom ?? null,
    expectedTo: doc.expectedTo ?? null,
    status: doc.status,
    receivedDate: doc.receivedDate ?? null,
    categoryId: doc.categoryId ?? null,
    accountId: doc.accountId ?? null,
    note: doc.note ?? null,
  }));
}

export async function getOpenRefundTotal(userId: string) {
  const rows = await refunds
    .aggregate<{ _id: null; sum: number; count: number }>([
      { $match: { userId, status: "open" } },
      { $group: { _id: null, sum: { $sum: "$amountCents" }, count: { $sum: 1 } } },
    ])
    .toArray();

  return { cents: rows[0]?.sum ?? 0, count: rows[0]?.count ?? 0 };
}
