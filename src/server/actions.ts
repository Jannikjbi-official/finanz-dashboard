"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { assertSession, UnauthorizedError } from "@/lib/auth/session";
import { fromIso, todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  appSetting,
  category,
  expense,
  income,
  loginHandoff,
  recurringRule,
  subscription,
  wish,
} from "@/lib/db/schema";
import { advanceDate } from "@/lib/finance";
import {
  type ActionResult,
  categorySchema,
  expenseSchema,
  expenseUpdateSchema,
  fieldErrors,
  incomeSchema,
  settingsSchema,
  subscriptionSchema,
  wishSchema,
} from "@/lib/validation";
import { type ExpenseRow, listExpenses } from "./queries";

/* ── Hilfen ───────────────────────────────────────────────────────────────── */

function fail(error: unknown): ActionResult<never> {
  if (error instanceof UnauthorizedError) return { ok: false, error: "Bitte melde dich erneut an." };
  if (error instanceof z.ZodError) {
    return { ok: false, error: "Bitte prüfe deine Eingaben.", fieldErrors: fieldErrors(error) };
  }
  console.error(error);
  return { ok: false, error: "Das hat nicht geklappt. Bitte versuche es erneut." };
}

/** Session prüfen, Eingabe validieren, Aktion ausführen, Cache erneuern. */
async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    await assertSession();
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    return fail(error);
  }
}

const uuidList = z.array(z.uuid()).min(1).max(5000);

/* ── Ausgaben ─────────────────────────────────────────────────────────────── */

export async function createExpense(input: unknown) {
  return run(async () => {
    const v = expenseSchema.parse(input);
    return db.transaction(async (tx) => {
      let recurringId: string | null = null;
      if (v.recurring && v.interval) {
        const start = fromIso(v.date);
        const [rule] = await tx
          .insert(recurringRule)
          .values({
            kind: "ausgabe",
            amountCents: v.amountCents,
            interval: v.interval,
            categoryId: v.categoryId,
            paymentMethod: v.paymentMethod,
            note: v.note,
            anchorDay: start.day,
            nextDate: advanceDate(start, v.interval, start.day).toString(),
          })
          .returning({ id: recurringRule.id });
        recurringId = rule?.id ?? null;
      }
      const [row] = await tx
        .insert(expense)
        .values({
          amountCents: v.amountCents,
          categoryId: v.categoryId,
          date: v.date,
          paymentMethod: v.paymentMethod,
          note: v.note,
          recurringId,
          clientId: v.clientId,
        })
        .onConflictDoNothing({ target: expense.clientId })
        .returning({ id: expense.id });
      return { id: row?.id ?? null };
    });
  });
}

export async function updateExpense(input: unknown) {
  return run(async () => {
    const v = expenseUpdateSchema.parse(input);
    await db
      .update(expense)
      .set({
        amountCents: v.amountCents,
        categoryId: v.categoryId,
        date: v.date,
        paymentMethod: v.paymentMethod,
        note: v.note,
      })
      .where(eq(expense.id, v.id));
    return { id: v.id };
  });
}

export async function deleteExpenses(ids: unknown) {
  return run(async () => {
    const list = uuidList.parse(ids);
    const rows = await db.delete(expense).where(inArray(expense.id, list)).returning();
    return rows;
  });
}

const restoreExpenseSchema = z.array(
  z.object({
    id: z.uuid(),
    amountCents: z.number().int().positive(),
    categoryId: z.uuid().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paymentMethod: z.enum(["bar", "karte", "paypal", "ueberweisung"]),
    note: z.string().max(500).nullable(),
    recurringId: z.uuid().nullable(),
    clientId: z.uuid().nullable(),
    createdAt: z.coerce.date(),
  }),
);

/** „Rückgängig“ nach dem Löschen */
export async function restoreExpenses(rows: unknown) {
  return run(async () => {
    const list = restoreExpenseSchema.parse(rows);
    if (list.length) await db.insert(expense).values(list).onConflictDoNothing();
    return { count: list.length };
  });
}

/** Asynchrones Laden der Ausgaben für die Tabelle */
export async function fetchExpenses(from: string, to: string): Promise<ActionResult<ExpenseRow[]>> {
  try {
    await assertSession();
    const range = z
      .object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse({ from, to });
    return { ok: true, data: await listExpenses(range.from, range.to) };
  } catch (error) {
    return fail(error);
  }
}

/* ── Einnahmen ────────────────────────────────────────────────────────────── */

export async function createIncome(input: unknown) {
  return run(async () => {
    const v = incomeSchema.parse(input);
    return db.transaction(async (tx) => {
      let recurringId: string | null = null;
      if (v.recurring && v.interval) {
        const start = fromIso(v.date);
        const [rule] = await tx
          .insert(recurringRule)
          .values({
            kind: "einnahme",
            amountCents: v.amountCents,
            interval: v.interval,
            source: v.source,
            note: v.note,
            anchorDay: start.day,
            nextDate: advanceDate(start, v.interval, start.day).toString(),
          })
          .returning({ id: recurringRule.id });
        recurringId = rule?.id ?? null;
      }
      const [row] = await tx
        .insert(income)
        .values({
          amountCents: v.amountCents,
          source: v.source,
          date: v.date,
          note: v.note,
          recurringId,
          clientId: v.clientId,
        })
        .onConflictDoNothing({ target: income.clientId })
        .returning({ id: income.id });
      return { id: row?.id ?? null };
    });
  });
}

export async function deleteIncomes(ids: unknown) {
  return run(async () => {
    const list = uuidList.parse(ids);
    return db.delete(income).where(inArray(income.id, list)).returning();
  });
}

export async function restoreIncomes(rows: unknown) {
  return run(async () => {
    const list = z
      .array(
        z.object({
          id: z.uuid(),
          amountCents: z.number().int().positive(),
          source: z.string().min(1).max(60),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          note: z.string().max(500).nullable(),
          recurringId: z.uuid().nullable(),
          clientId: z.uuid().nullable(),
          createdAt: z.coerce.date(),
        }),
      )
      .parse(rows);
    if (list.length) await db.insert(income).values(list).onConflictDoNothing();
    return { count: list.length };
  });
}

export async function stopRecurringRule(id: unknown) {
  return run(async () => {
    const ruleId = z.uuid().parse(id);
    await db.update(recurringRule).set({ active: false }).where(eq(recurringRule.id, ruleId));
    return { id: ruleId };
  });
}

/* ── Abos ─────────────────────────────────────────────────────────────────── */

export async function saveSubscription(input: unknown) {
  return run(async () => {
    const { id, ...v } = subscriptionSchema.parse(input);
    if (id) {
      await db.update(subscription).set(v).where(eq(subscription.id, id));
      return { id };
    }
    const [row] = await db.insert(subscription).values(v).returning({ id: subscription.id });
    return { id: row!.id };
  });
}

export async function setSubscriptionStatus(id: unknown, status: unknown) {
  return run(async () => {
    const v = z
      .object({ id: z.uuid(), status: z.enum(["aktiv", "pausiert", "gekuendigt"]) })
      .parse({ id, status });
    await db.update(subscription).set({ status: v.status }).where(eq(subscription.id, v.id));
    return v;
  });
}

export async function deleteSubscription(id: unknown) {
  return run(async () => {
    const subId = z.uuid().parse(id);
    await db.delete(subscription).where(eq(subscription.id, subId));
    return { id: subId };
  });
}

/* ── Wunschliste ──────────────────────────────────────────────────────────── */

export async function saveWish(input: unknown) {
  return run(async () => {
    const { id, ...v } = wishSchema.parse(input);
    if (id) {
      await db.update(wish).set(v).where(eq(wish.id, id));
      return { id };
    }
    const [row] = await db.insert(wish).values(v).returning({ id: wish.id });
    return { id: row!.id };
  });
}

export async function addWishSavings(id: unknown, cents: unknown) {
  return run(async () => {
    const v = z
      .object({ id: z.uuid(), cents: z.number().int().min(-100_000_000).max(100_000_000) })
      .parse({ id, cents });
    if (v.cents === 0) throw new z.ZodError([{ code: "custom", path: ["cents"], message: "Bitte einen Betrag eingeben.", input: 0 }]);
    const [row] = await db
      .update(wish)
      .set({ savedCents: sql`greatest(0, ${wish.savedCents} + ${v.cents})` })
      .where(eq(wish.id, v.id))
      .returning({ savedCents: wish.savedCents });
    return { savedCents: row?.savedCents ?? 0 };
  });
}

export async function purchaseWish(input: unknown) {
  return run(async () => {
    const v = z
      .object({ id: z.uuid(), asExpense: z.boolean(), categoryId: z.uuid().nullable().optional() })
      .parse(input);
    return db.transaction(async (tx) => {
      const [w] = await tx
        .update(wish)
        .set({ purchasedAt: new Date() })
        .where(and(eq(wish.id, v.id), isNull(wish.purchasedAt)))
        .returning();
      if (!w) return { expenseId: null };
      if (!v.asExpense) return { expenseId: null };
      const [e] = await tx
        .insert(expense)
        .values({
          amountCents: w.priceCents,
          categoryId: v.categoryId ?? null,
          date: todayIso(),
          paymentMethod: "karte",
          note: w.title,
        })
        .returning({ id: expense.id });
      return { expenseId: e?.id ?? null };
    });
  });
}

export async function deleteWish(id: unknown) {
  return run(async () => {
    const wishId = z.uuid().parse(id);
    await db.delete(wish).where(eq(wish.id, wishId));
    return { id: wishId };
  });
}

/* ── Kategorien & Budgets ─────────────────────────────────────────────────── */

export async function saveCategory(input: unknown) {
  return run(async () => {
    const { id, ...v } = categorySchema.parse(input);
    try {
      if (id) {
        await db.update(category).set(v).where(eq(category.id, id));
        return { id };
      }
      const [max] = await db.select({ m: sql<number>`coalesce(max(${category.sortOrder}), 0)::int` }).from(category);
      const [row] = await db
        .insert(category)
        .values({ ...v, sortOrder: (max?.m ?? 0) + 1 })
        .returning({ id: category.id });
      return { id: row!.id };
    } catch (e) {
      if (String((e as { cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code) === "23505") {
        throw new z.ZodError([
          { code: "custom", path: ["name"], message: "Diese Kategorie gibt es schon.", input: v.name },
        ]);
      }
      throw e;
    }
  });
}

export async function setCategoryBudget(id: unknown, cents: unknown) {
  return run(async () => {
    const v = z
      .object({ id: z.uuid(), cents: z.number().int().min(0).max(1_000_000_000).nullable() })
      .parse({ id, cents });
    await db
      .update(category)
      .set({ budgetCents: v.cents && v.cents > 0 ? v.cents : null })
      .where(eq(category.id, v.id));
    return v;
  });
}

export async function deleteCategory(id: unknown) {
  return run(async () => {
    const catId = z.uuid().parse(id);
    await db.delete(category).where(eq(category.id, catId));
    return { id: catId };
  });
}

/* ── Einstellungen & Daten ────────────────────────────────────────────────── */

export async function saveSettings(input: unknown) {
  return run(async () => {
    const v = settingsSchema.parse(input);
    for (const [key, value] of Object.entries(v)) {
      if (value === undefined) continue;
      if (value === null) {
        await db.delete(appSetting).where(eq(appSetting.key, key));
        continue;
      }
      await db
        .insert(appSetting)
        .values({ key, value })
        .onConflictDoUpdate({ target: appSetting.key, set: { value, updatedAt: new Date() } });
    }
    return v;
  });
}

export async function deleteAllData(confirmation: unknown) {
  return run(async () => {
    if (confirmation !== "LÖSCHEN") {
      throw new z.ZodError([
        { code: "custom", path: ["confirmation"], message: "Bitte genau LÖSCHEN eintippen.", input: confirmation },
      ]);
    }
    await db.transaction(async (tx) => {
      await tx.delete(expense);
      await tx.delete(income);
      await tx.delete(recurringRule);
      await tx.delete(subscription);
      await tx.delete(wish);
      await tx.delete(category);
      await tx.delete(appSetting);
      await tx.delete(loginHandoff);
    });
    return { ok: true };
  });
}

const backupSchema = z.object({
  version: z.literal(1),
  data: z.object({
    categories: z.array(
      z.object({
        id: z.uuid(),
        name: z.string().min(1).max(40),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        icon: z.string().max(40),
        budgetCents: z.number().int().nullable(),
        sortOrder: z.number().int(),
      }),
    ),
    recurringRules: z.array(
      z.object({
        id: z.uuid(),
        kind: z.enum(["ausgabe", "einnahme"]),
        amountCents: z.number().int().positive(),
        interval: z.enum(["woechentlich", "monatlich", "vierteljaehrlich", "jaehrlich"]),
        categoryId: z.uuid().nullable(),
        source: z.string().nullable(),
        paymentMethod: z.enum(["bar", "karte", "paypal", "ueberweisung"]).nullable(),
        note: z.string().nullable(),
        nextDate: z.string(),
        anchorDay: z.number().int().min(1).max(31),
        active: z.boolean(),
      }),
    ),
    expenses: z.array(
      z.object({
        id: z.uuid(),
        amountCents: z.number().int().positive(),
        categoryId: z.uuid().nullable(),
        date: z.string(),
        paymentMethod: z.enum(["bar", "karte", "paypal", "ueberweisung"]),
        note: z.string().nullable(),
        recurringId: z.uuid().nullable(),
        clientId: z.uuid().nullable(),
      }),
    ),
    incomes: z.array(
      z.object({
        id: z.uuid(),
        amountCents: z.number().int().positive(),
        source: z.string().min(1),
        date: z.string(),
        note: z.string().nullable(),
        recurringId: z.uuid().nullable(),
        clientId: z.uuid().nullable(),
      }),
    ),
    subscriptions: z.array(
      z.object({
        id: z.uuid(),
        name: z.string().min(1),
        priceCents: z.number().int().positive(),
        interval: z.enum(["woechentlich", "monatlich", "vierteljaehrlich", "jaehrlich"]),
        billingDay: z.number().int().min(1).max(31),
        categoryId: z.uuid().nullable(),
        startDate: z.string(),
        cancellationDeadline: z.string().nullable(),
        note: z.string().nullable(),
        status: z.enum(["aktiv", "pausiert", "gekuendigt"]),
      }),
    ),
    wishes: z.array(
      z.object({
        id: z.uuid(),
        title: z.string().min(1),
        priceCents: z.number().int().positive(),
        url: z.string().nullable(),
        imageUrl: z.string().nullable(),
        priority: z.enum(["hoch", "mittel", "niedrig"]),
        note: z.string().nullable(),
        savedCents: z.number().int().min(0),
        purchasedAt: z.coerce.date().nullable(),
      }),
    ),
    settings: z.array(z.object({ key: z.string().max(60), value: z.unknown() })),
  }),
});

/** Backup einspielen – ersetzt alle vorhandenen Finanzdaten. */
export async function importBackup(json: unknown) {
  return run(async () => {
    const parsed = backupSchema.safeParse(typeof json === "string" ? JSON.parse(json) : json);
    if (!parsed.success) {
      throw new z.ZodError([
        { code: "custom", path: ["file"], message: "Die Datei ist kein gültiges Finanzen-Backup.", input: null },
      ]);
    }
    const d = parsed.data.data;
    await db.transaction(async (tx) => {
      await tx.delete(expense);
      await tx.delete(income);
      await tx.delete(recurringRule);
      await tx.delete(subscription);
      await tx.delete(wish);
      await tx.delete(category);
      await tx.delete(appSetting);
      if (d.categories.length) await tx.insert(category).values(d.categories);
      if (d.recurringRules.length) await tx.insert(recurringRule).values(d.recurringRules);
      if (d.expenses.length) await tx.insert(expense).values(d.expenses);
      if (d.incomes.length) await tx.insert(income).values(d.incomes);
      if (d.subscriptions.length) await tx.insert(subscription).values(d.subscriptions);
      if (d.wishes.length) await tx.insert(wish).values(d.wishes);
      const settings = d.settings.filter((s) => s.value !== undefined && s.value !== null);
      if (settings.length) await tx.insert(appSetting).values(settings as { key: string; value: unknown }[]);
    });
    return {
      expenses: d.expenses.length,
      incomes: d.incomes.length,
      subscriptions: d.subscriptions.length,
      wishes: d.wishes.length,
    };
  });
}
