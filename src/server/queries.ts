import "server-only";
import { endOfMonth, startOfMonth, type CalendarDate } from "@internationalized/date";
import { and, asc, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { cache } from "react";
import { requireSession } from "@/lib/auth/session";
import { fromIso, monthKey, monthRange, today, todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { appSetting, category, expense, income, recurringRule, subscription, wish } from "@/lib/db/schema";
import {
  type IntervalId,
  type SubscriptionLike,
  budgetLevel,
  chargesBetween,
  chargesInMonth,
  nextChargeAfter,
  perMonthCents,
  perYearCents,
} from "@/lib/finance";
import { ensureDefaultCategories } from "./defaults";
import { ensureRecurringMaterialized } from "./recurring";

/** Jede Abfrage prüft die Session (Seiten rendern parallel zum Layout). */
async function guard() {
  await requireSession();
  await Promise.all([ensureRecurringMaterialized(), ensureDefaultCategories()]);
}

/* ── Einstellungen & Stammdaten ───────────────────────────────────────────── */

export interface AppSettings {
  accentColor: string | null;
  startBalanceCents: number;
}

export const getSettings = cache(async (): Promise<AppSettings> => {
  await requireSession();
  const rows = await db.select().from(appSetting);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    accentColor: typeof map.get("accentColor") === "string" ? (map.get("accentColor") as string) : null,
    startBalanceCents: typeof map.get("startBalanceCents") === "number" ? (map.get("startBalanceCents") as number) : 0,
  };
});

export type CategoryRow = typeof category.$inferSelect;

export const getCategories = cache(async (): Promise<CategoryRow[]> => {
  await requireSession();
  await ensureDefaultCategories();
  return db.select().from(category).orderBy(asc(category.sortOrder), asc(category.name));
});

export type SubscriptionRow = typeof subscription.$inferSelect & SubscriptionLike;

export const getSubscriptions = cache(async (): Promise<SubscriptionRow[]> => {
  await requireSession();
  const rows = await db.select().from(subscription).orderBy(asc(subscription.name));
  return rows as SubscriptionRow[];
});

/* ── Summen ───────────────────────────────────────────────────────────────── */

async function sumExpenses(from: string, to: string): Promise<number> {
  const [r] = await db
    .select({ total: sql<number>`coalesce(sum(${expense.amountCents}), 0)::int` })
    .from(expense)
    .where(and(gte(expense.date, from), lte(expense.date, to)));
  return r?.total ?? 0;
}

async function sumIncome(from: string, to: string): Promise<number> {
  const [r] = await db
    .select({ total: sql<number>`coalesce(sum(${income.amountCents}), 0)::int` })
    .from(income)
    .where(and(gte(income.date, from), lte(income.date, to)));
  return r?.total ?? 0;
}

function sumCharges(subs: SubscriptionRow[], from: CalendarDate, to: CalendarDate): number {
  return subs.flatMap((s) => chargesBetween(s, from, to)).reduce((a, c) => a + c.subscription.priceCents, 0);
}

export interface MonthTotals {
  incomeCents: number;
  expenseCents: number;
  aboCents: number;
  leftCents: number;
}

async function monthTotals(month: string, subs: SubscriptionRow[]): Promise<MonthTotals> {
  const { start, end } = monthRange(month);
  const [incomeCents, expenseCents] = await Promise.all([
    sumIncome(start.toString(), end.toString()),
    sumExpenses(start.toString(), end.toString()),
  ]);
  const aboCents = sumCharges(subs, start, end);
  return { incomeCents, expenseCents, aboCents, leftCents: incomeCents - expenseCents - aboCents };
}

/** Kontostand vor einem Datum: Startguthaben + alle Einnahmen − Ausgaben − Abos. */
async function balanceBefore(date: CalendarDate, subs: SubscriptionRow[], startBalance: number): Promise<number> {
  const iso = date.toString();
  const [[inc], [exp]] = await Promise.all([
    db
      .select({ t: sql<number>`coalesce(sum(${income.amountCents}), 0)::bigint` })
      .from(income)
      .where(lt(income.date, iso)),
    db
      .select({ t: sql<number>`coalesce(sum(${expense.amountCents}), 0)::bigint` })
      .from(expense)
      .where(lt(expense.date, iso)),
  ]);
  const earliest = subs.reduce<string | null>(
    (min, s) => (min === null || s.startDate < min ? s.startDate : min),
    null,
  );
  const abos = earliest && earliest < iso ? sumCharges(subs, fromIso(earliest), date.subtract({ days: 1 })) : 0;
  return startBalance + Number(inc?.t ?? 0) - Number(exp?.t ?? 0) - abos;
}

/* ── Dashboard ────────────────────────────────────────────────────────────── */

export interface CategorySlice {
  id: string | null;
  name: string;
  color: string;
  icon: string;
  cents: number;
}

export interface UpcomingItem {
  id: string;
  date: string;
  name: string;
  cents: number;
  kind: "abo" | "ausgabe" | "einnahme";
  color: string | null;
}

export interface BudgetStatus {
  id: string;
  name: string;
  color: string;
  icon: string;
  budgetCents: number;
  spentCents: number;
  level: "ok" | "warning" | "over";
}

async function spendingByCategory(
  from: CalendarDate,
  to: CalendarDate,
  subs: SubscriptionRow[],
  cats: CategoryRow[],
): Promise<CategorySlice[]> {
  const rows = await db
    .select({
      categoryId: expense.categoryId,
      total: sql<number>`sum(${expense.amountCents})::int`,
    })
    .from(expense)
    .where(and(gte(expense.date, from.toString()), lte(expense.date, to.toString())))
    .groupBy(expense.categoryId);

  const totals = new Map<string | null, number>();
  for (const r of rows) totals.set(r.categoryId, (totals.get(r.categoryId) ?? 0) + r.total);
  for (const s of subs) {
    const c = chargesBetween(s, from, to).reduce((a, x) => a + x.subscription.priceCents, 0);
    if (c > 0) totals.set(s.categoryId, (totals.get(s.categoryId) ?? 0) + c);
  }
  const byId = new Map(cats.map((c) => [c.id, c]));
  return [...totals.entries()]
    .map(([id, cents]) => {
      const c = id ? byId.get(id) : undefined;
      return {
        id: c?.id ?? null,
        name: c?.name ?? "Ohne Kategorie",
        color: c?.color ?? "#8b8d98",
        icon: c?.icon ?? "circle",
        cents,
      };
    })
    .filter((s) => s.cents > 0)
    .sort((a, b) => b.cents - a.cents);
}

async function monthlySeries(endMonth: string, count: number, subs: SubscriptionRow[]) {
  const end = endOfMonth(fromIso(`${endMonth}-01`));
  const start = startOfMonth(end).subtract({ months: count - 1 });
  const [inc, exp] = await Promise.all([
    db
      .select({ m: sql<string>`to_char(${income.date}, 'YYYY-MM')`, t: sql<number>`sum(${income.amountCents})::int` })
      .from(income)
      .where(and(gte(income.date, start.toString()), lte(income.date, end.toString())))
      .groupBy(sql`1`),
    db
      .select({ m: sql<string>`to_char(${expense.date}, 'YYYY-MM')`, t: sql<number>`sum(${expense.amountCents})::int` })
      .from(expense)
      .where(and(gte(expense.date, start.toString()), lte(expense.date, end.toString())))
      .groupBy(sql`1`),
  ]);
  const incMap = new Map(inc.map((r) => [r.m, r.t]));
  const expMap = new Map(exp.map((r) => [r.m, r.t]));
  return Array.from({ length: count }, (_, i) => {
    const d = start.add({ months: i });
    const key = monthKey(d);
    const abos = chargesInMonth(subs, d).reduce((a, c) => a + c.subscription.priceCents, 0);
    return {
      month: key,
      incomeCents: incMap.get(key) ?? 0,
      expenseCents: (expMap.get(key) ?? 0) + abos,
    };
  });
}

export async function getUpcoming(days: number): Promise<UpcomingItem[]> {
  const subs = await getSubscriptions();
  const from = today();
  const to = from.add({ days });
  const items: UpcomingItem[] = subs.flatMap((s) =>
    chargesBetween(s, from, to).map((c) => ({
      id: `abo-${s.id}-${c.date}`,
      date: c.date,
      name: s.name,
      cents: s.priceCents,
      kind: "abo" as const,
      color: null,
    })),
  );
  const rules = await db
    .select()
    .from(recurringRule)
    .where(and(eq(recurringRule.active, true), lte(recurringRule.nextDate, to.toString())));
  for (const r of rules) {
    items.push({
      id: `rule-${r.id}`,
      date: r.nextDate,
      name: r.kind === "einnahme" ? (r.source ?? "Einnahme") : (r.note ?? "Wiederkehrende Ausgabe"),
      cents: r.amountCents,
      kind: r.kind,
      color: null,
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getBudgetStatus(month: string): Promise<BudgetStatus[]> {
  const [cats, subs] = await Promise.all([getCategories(), getSubscriptions()]);
  const { start, end } = monthRange(month);
  const slices = await spendingByCategory(start, end, subs, cats);
  const spent = new Map(slices.map((s) => [s.id, s.cents]));
  return cats
    .filter((c) => c.budgetCents && c.budgetCents > 0)
    .map((c) => {
      const spentCents = spent.get(c.id) ?? 0;
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        budgetCents: c.budgetCents ?? 0,
        spentCents,
        level: budgetLevel(spentCents, c.budgetCents),
      };
    });
}

export async function getDashboard(month: string) {
  await guard();
  const [subs, cats, settings] = await Promise.all([getSubscriptions(), getCategories(), getSettings()]);
  const { start, end } = monthRange(month);
  const prevMonth = monthKey(start.subtract({ months: 1 }));
  const t = today();

  const [current, previous, slices, series, opening, upcoming, budgets] = await Promise.all([
    monthTotals(month, subs),
    monthTotals(prevMonth, subs),
    spendingByCategory(start, end, subs, cats),
    monthlySeries(month, 12, subs),
    balanceBefore(start, subs, settings.startBalanceCents),
    getUpcoming(7),
    getBudgetStatus(month),
  ]);

  // Kontostand-Verlauf im Monat (täglich)
  const [incDaily, expDaily] = await Promise.all([
    db
      .select({ d: income.date, t: sql<number>`sum(${income.amountCents})::int` })
      .from(income)
      .where(and(gte(income.date, start.toString()), lte(income.date, end.toString())))
      .groupBy(income.date),
    db
      .select({ d: expense.date, t: sql<number>`sum(${expense.amountCents})::int` })
      .from(expense)
      .where(and(gte(expense.date, start.toString()), lte(expense.date, end.toString())))
      .groupBy(expense.date),
  ]);
  const delta = new Map<string, number>();
  for (const r of incDaily) delta.set(r.d, (delta.get(r.d) ?? 0) + r.t);
  for (const r of expDaily) delta.set(r.d, (delta.get(r.d) ?? 0) - r.t);
  for (const c of chargesInMonth(subs, start)) {
    delta.set(c.date, (delta.get(c.date) ?? 0) - c.subscription.priceCents);
  }
  const isCurrent = t.compare(start) >= 0 && t.compare(end) <= 0;
  const lastDay = isCurrent ? t.day : end.day;
  const isFuture = t.compare(start) < 0;
  let running = opening;
  const balance: { date: string; day: number; cents: number }[] = [];
  if (!isFuture) {
    for (let day = 1; day <= lastDay; day++) {
      const d = start.set({ day }).toString();
      running += delta.get(d) ?? 0;
      balance.push({ date: d, day, cents: running });
    }
  }

  const daysTotal = end.day;
  const daysPassed = isFuture ? 0 : isCurrent ? t.day : daysTotal;
  const daysRemaining = isCurrent ? daysTotal - t.day + 1 : isFuture ? daysTotal : 0;

  return {
    month,
    isCurrent,
    current,
    previous,
    slices,
    series,
    balance,
    openingCents: opening,
    upcoming,
    budgets,
    monthProgress: daysPassed / daysTotal,
    perDayCents: daysRemaining > 0 ? Math.floor(Math.max(0, current.leftCents) / daysRemaining) : 0,
    perDayMaxCents: Math.max(1, Math.round(current.incomeCents / daysTotal)),
    daysRemaining,
  };
}
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/* ── Ausgaben ─────────────────────────────────────────────────────────────── */

export interface ExpenseRow {
  id: string;
  amountCents: number;
  date: string;
  paymentMethod: "bar" | "karte" | "paypal" | "ueberweisung";
  note: string | null;
  categoryId: string | null;
  recurring: boolean;
}

export async function listExpenses(from: string, to: string): Promise<ExpenseRow[]> {
  await guard();
  const rows = await db
    .select({
      id: expense.id,
      amountCents: expense.amountCents,
      date: expense.date,
      paymentMethod: expense.paymentMethod,
      note: expense.note,
      categoryId: expense.categoryId,
      recurringId: expense.recurringId,
    })
    .from(expense)
    .where(and(gte(expense.date, from), lte(expense.date, to)))
    .orderBy(desc(expense.date), desc(expense.createdAt))
    .limit(5000);
  return rows.map(({ recurringId, ...r }) => ({ ...r, recurring: !!recurringId }));
}

/* ── Einnahmen ────────────────────────────────────────────────────────────── */

export interface IncomeRow {
  id: string;
  amountCents: number;
  source: string;
  date: string;
  note: string | null;
  recurring: boolean;
}

export async function getIncomePage(month: string) {
  await guard();
  const { start, end } = monthRange(month);
  const yearStart = start.set({ month: 1, day: 1 });
  const yearEnd = start.set({ month: 12, day: 31 });
  const [rows, sources, subs] = await Promise.all([
    db
      .select()
      .from(income)
      .where(and(gte(income.date, yearStart.toString()), lte(income.date, yearEnd.toString())))
      .orderBy(desc(income.date), desc(income.createdAt)),
    db.selectDistinct({ source: income.source }).from(income).orderBy(asc(income.source)),
    getSubscriptions(),
  ]);
  const series = await monthlySeries(month, 12, subs);
  const mapped: IncomeRow[] = rows.map((r) => ({
    id: r.id,
    amountCents: r.amountCents,
    source: r.source,
    date: r.date,
    note: r.note,
    recurring: !!r.recurringId,
  }));
  const recurringRules = await db
    .select()
    .from(recurringRule)
    .where(eq(recurringRule.active, true))
    .orderBy(asc(recurringRule.nextDate));
  return {
    month,
    year: start.year,
    monthRows: mapped.filter((r) => r.date >= start.toString() && r.date <= end.toString()),
    yearRows: mapped,
    sources: sources.map((s) => s.source),
    series,
    recurringRules: recurringRules.map((r) => ({
      id: r.id,
      kind: r.kind,
      amountCents: r.amountCents,
      interval: r.interval as IntervalId,
      nextDate: r.nextDate,
      label: r.kind === "einnahme" ? (r.source ?? "Einnahme") : (r.note ?? "Ausgabe"),
      categoryId: r.categoryId,
    })),
  };
}

/* ── Abos ─────────────────────────────────────────────────────────────────── */

export async function getSubscriptionPage() {
  await guard();
  const [subs, cats] = await Promise.all([getSubscriptions(), getCategories()]);
  const t = today();
  const active = subs.filter((s) => s.status === "aktiv");
  const monthly = active.reduce((a, s) => a + perMonthCents(s.priceCents, s.interval), 0);
  const yearly = active.reduce((a, s) => a + perYearCents(s.priceCents, s.interval), 0);
  return {
    categories: cats,
    totals: { monthlyCents: monthly, yearlyCents: yearly, activeCount: active.length },
    subscriptions: subs.map((s) => ({
      ...s,
      monthlyCents: perMonthCents(s.priceCents, s.interval),
      yearlyCents: perYearCents(s.priceCents, s.interval),
      nextCharge: nextChargeAfter(s, t),
      deadlineInDays:
        s.cancellationDeadline && s.status !== "gekuendigt" ? fromIso(s.cancellationDeadline).compare(t) : null,
    })),
    /** Abbuchungstage der nächsten 12 Monate für den Kalender */
    chargeDates: subs.flatMap((s) =>
      chargesBetween(s, startOfMonth(t).subtract({ months: 1 }), t.add({ months: 12 })).map((c) => ({
        date: c.date,
        name: s.name,
        cents: s.priceCents,
      })),
    ),
  };
}
export type SubscriptionPageData = Awaited<ReturnType<typeof getSubscriptionPage>>;

/* ── Wunschliste ──────────────────────────────────────────────────────────── */

export async function getWishPage() {
  await guard();
  const [wishes, subs] = await Promise.all([
    db.select().from(wish).where(isNull(wish.purchasedAt)).orderBy(desc(wish.createdAt)),
    getSubscriptions(),
  ]);
  const totals = await monthTotals(monthKey(today()), subs);
  const purchased = await db
    .select()
    .from(wish)
    .where(sql`${wish.purchasedAt} is not null`)
    .orderBy(desc(wish.purchasedAt))
    .limit(20);
  return { wishes, purchased, leftThisMonthCents: totals.leftCents };
}

/* ── Budgets & Kategorien ─────────────────────────────────────────────────── */

export async function getBudgetPage(month: string) {
  await guard();
  const [cats, budgets, subs] = await Promise.all([getCategories(), getBudgetStatus(month), getSubscriptions()]);
  const { start, end } = monthRange(month);
  const slices = await spendingByCategory(start, end, subs, cats);
  const counts = await db
    .select({ id: expense.categoryId, n: sql<number>`count(*)::int` })
    .from(expense)
    .groupBy(expense.categoryId);
  return {
    month,
    categories: cats.map((c) => ({
      ...c,
      spentCents: slices.find((s) => s.id === c.id)?.cents ?? 0,
      expenseCount: counts.find((x) => x.id === c.id)?.n ?? 0,
    })),
    budgets,
  };
}

/* ── Statistik ────────────────────────────────────────────────────────────── */

export async function getStats(from: string, to: string) {
  await guard();
  const [subs, cats] = await Promise.all([getSubscriptions(), getCategories()]);
  const f = fromIso(from);
  const tt = fromIso(to);
  const days = tt.compare(f) + 1;
  const prevTo = f.subtract({ days: 1 });
  const prevFrom = prevTo.subtract({ days: days - 1 });

  const [incomeCents, expenseOnly, prevIncome, prevExpenseOnly, slices, top, daily] = await Promise.all([
    sumIncome(from, to),
    sumExpenses(from, to),
    sumIncome(prevFrom.toString(), prevTo.toString()),
    sumExpenses(prevFrom.toString(), prevTo.toString()),
    spendingByCategory(f, tt, subs, cats),
    db
      .select({
        id: expense.id,
        amountCents: expense.amountCents,
        date: expense.date,
        note: expense.note,
        categoryId: expense.categoryId,
        paymentMethod: expense.paymentMethod,
      })
      .from(expense)
      .where(and(gte(expense.date, from), lte(expense.date, to)))
      .orderBy(desc(expense.amountCents))
      .limit(10),
    db
      .select({ d: expense.date, t: sql<number>`sum(${expense.amountCents})::int` })
      .from(expense)
      .where(and(gte(expense.date, from), lte(expense.date, to)))
      .groupBy(expense.date),
  ]);
  const aboCents = sumCharges(subs, f, tt);
  const prevAbo = sumCharges(subs, prevFrom, prevTo);
  const spendCents = expenseOnly + aboCents;
  const prevSpend = prevExpenseOnly + prevAbo;

  // Täglicher Verlauf inkl. Abo-Abbuchungen
  const perDay = new Map(daily.map((r) => [r.d, r.t]));
  for (const s of subs) {
    for (const c of chargesBetween(s, f, tt)) perDay.set(c.date, (perDay.get(c.date) ?? 0) + s.priceCents);
  }
  const useMonths = days > 92;
  const timeline: { key: string; cents: number }[] = [];
  if (useMonths) {
    const buckets = new Map<string, number>();
    for (let d = f; d.compare(tt) <= 0; d = d.add({ days: 1 })) {
      const k = monthKey(d);
      buckets.set(k, (buckets.get(k) ?? 0) + (perDay.get(d.toString()) ?? 0));
    }
    for (const [key, cents] of buckets) timeline.push({ key, cents });
  } else {
    for (let d = f; d.compare(tt) <= 0; d = d.add({ days: 1 })) {
      timeline.push({ key: d.toString(), cents: perDay.get(d.toString()) ?? 0 });
    }
  }

  return {
    from,
    to,
    days,
    incomeCents,
    spendCents,
    expenseCents: expenseOnly,
    aboCents,
    previous: { incomeCents: prevIncome, spendCents: prevSpend, from: prevFrom.toString(), to: prevTo.toString() },
    perDayCents: Math.round(spendCents / days),
    perWeekCents: Math.round((spendCents / days) * 7),
    perMonthCents: Math.round((spendCents / days) * 30.44),
    savingsRate: incomeCents > 0 ? (incomeCents - spendCents) / incomeCents : 0,
    slices,
    top,
    timeline,
    timelineUnit: useMonths ? ("month" as const) : ("day" as const),
    categories: cats,
  };
}
export type StatsData = Awaited<ReturnType<typeof getStats>>;

/* ── Export ───────────────────────────────────────────────────────────────── */

export async function getAllData() {
  await requireSession();
  const [categories, expenses, incomes, subscriptions, wishes, rules, settings] = await Promise.all([
    db.select().from(category).orderBy(asc(category.sortOrder)),
    db.select().from(expense).orderBy(asc(expense.date)),
    db.select().from(income).orderBy(asc(income.date)),
    db.select().from(subscription).orderBy(asc(subscription.name)),
    db.select().from(wish).orderBy(asc(wish.createdAt)),
    db.select().from(recurringRule),
    db.select().from(appSetting),
  ]);
  return { categories, expenses, incomes, subscriptions, wishes, recurringRules: rules, settings };
}

export { todayIso };
