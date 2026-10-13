"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { todayIn } from "../../domain/calendar";
import { wishKey } from "../../domain/wishes";
import { MAX_IMPORT_ROWS } from "../../import";
import { categories, ensureIndexes, imports, toObjectId, transactions, wishes, type TransactionDoc, type WishDoc } from "../db";
import { getSettings } from "../user-data";
import {
  authorize,
  fail,
  fileNameSchema,
  firstIssue,
  isoDate,
  ok,
  optionalId,
  optionalIsoDate,
  optionalText,
  ownsAccount,
  ownsCategory,
  positiveAmount,
  refresh,
  text,
  type ActionResult,
} from "./shared";

/**
 * Wunschliste. Ein Wunsch aendert keine Zahl. "Einplanen" legt eine geplante
 * Zahlung (Buchung mit status "pending" und wishId) an - nur sie zaehlt in
 * "Aktuell verfuegbar" und in der Prognose.
 */

const link = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^https?:\/\/\S+$/i.test(value), "Bitte einen Link mit https:// angeben");

const wishSchema = z.object({
  id: optionalId,
  title: text(120, "Bitte angeben, was du kaufen möchtest"),
  amount: positiveAmount,
  targetDate: optionalIsoDate,
  priority: z.enum(["high", "normal", "low"]),
  group: optionalText(60),
  link,
  note: optionalText(500),
  categoryId: optionalId,
});

export type WishInput = z.input<typeof wishSchema>;

async function findWish(userId: string, id: string) {
  const _id = toObjectId(id);
  return _id ? wishes.findOne({ _id, userId }) : null;
}

/** Offene geplante Zahlung eines Wunsches (bezahlte bleiben unangetastet). */
async function pendingPayment(userId: string, wish: { transactionId: string | null }) {
  const _id = toObjectId(wish.transactionId);
  return _id ? transactions.findOne({ _id, userId, status: "pending" }) : null;
}

export async function saveWish(input: WishInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = wishSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;
  if (!(await ownsCategory(auth.userId, data.categoryId))) return fail("Kategorie nicht gefunden");
  await ensureIndexes();

  const fields = {
    title: data.title,
    amountCents: data.amount,
    targetDate: data.targetDate,
    priority: data.priority,
    group: data.group,
    link: data.link,
    note: data.note,
    categoryId: data.categoryId,
    updatedAt: new Date(),
  };

  if (data.id) {
    const existing = await findWish(auth.userId, data.id);
    if (!existing) return fail("Wunsch nicht gefunden");
    await wishes.updateOne({ _id: existing._id, userId: auth.userId }, { $set: fields });
    // Eingeplante Zahlung mitziehen, damit Prognose und Wunsch uebereinstimmen
    const payment = await pendingPayment(auth.userId, existing);
    if (payment) {
      await transactions.updateOne(
        { _id: payment._id, userId: auth.userId, status: "pending" },
        { $set: { title: data.title, amountCents: data.amount, categoryId: data.categoryId, updatedAt: new Date() } },
      );
    }
    refresh();
    return ok("Wunsch gespeichert");
  }

  await wishes.insertOne({ ...fields, userId: auth.userId, status: "idea", transactionId: null, createdAt: new Date() });
  refresh();
  return ok("Wunsch hinzugefügt");
}

const planSchema = z.object({
  id: z.string(),
  date: isoDate,
  accountId: z.string({ message: "Bitte ein Konto wählen" }).min(1, "Bitte ein Konto wählen"),
  amount: positiveAmount,
});

export type PlanWishInput = z.input<typeof planSchema>;

/**
 * Einplanen bzw. Termin aendern: legt eine geplante Zahlung an oder
 * verschiebt die vorhandene. Ab jetzt zaehlt der Kauf in "Aktuell verfuegbar".
 */
export async function planWish(input: PlanWishInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, date, accountId, amount } = parsed.data;

  const wish = await findWish(auth.userId, id);
  if (!wish) return fail("Wunsch nicht gefunden");
  if (wish.status === "bought" || wish.status === "dropped") return fail("Erst wieder auf die Wunschliste setzen, dann einplanen.");
  if (!(await ownsAccount(auth.userId, accountId))) return fail("Konto nicht gefunden");
  await ensureIndexes();

  const payment = await pendingPayment(auth.userId, wish);
  if (payment) {
    await transactions.updateOne(
      { _id: payment._id, userId: auth.userId, status: "pending" },
      { $set: { date, accountId, amountCents: amount, updatedAt: new Date() } },
    );
    await wishes.updateOne({ _id: wish._id, userId: auth.userId }, { $set: { status: "planned", amountCents: amount, updatedAt: new Date() } });
    refresh();
    return ok("Termin geändert");
  }

  const doc: TransactionDoc = {
    userId: auth.userId,
    type: "expense",
    status: "pending",
    amountCents: amount,
    date,
    title: wish.title,
    note: "Aus der Wunschliste",
    categoryId: wish.categoryId ?? null,
    accountId,
    transferGroupId: null,
    recurringId: null,
    recurringDue: null,
    wishId: wish._id.toString(),
    createdAt: new Date(),
  };
  const { insertedId } = await transactions.insertOne(doc);

  // Nur einplanen, wenn nicht gleichzeitig schon eingeplant wurde
  const linked = await wishes.updateOne(
    { _id: wish._id, userId: auth.userId, transactionId: wish.transactionId ?? null },
    { $set: { status: "planned", transactionId: insertedId.toString(), amountCents: amount, targetDate: wish.targetDate ?? date, updatedAt: new Date() } },
  );
  if (linked.modifiedCount === 0) {
    await transactions.deleteOne({ _id: insertedId, userId: auth.userId });
    return fail("Dieser Wunsch wurde gerade schon eingeplant. Die Ansicht wird aktualisiert.");
  }
  refresh();
  return ok("Eingeplant – zählt jetzt in „Aktuell verfügbar“");
}

/** Nicht mehr einplanen: geplante Zahlung entfernen, Wunsch bleibt. */
export async function unplanWish(id: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const wish = await findWish(auth.userId, id);
  if (!wish) return fail("Wunsch nicht gefunden");

  const payment = await pendingPayment(auth.userId, wish);
  if (payment) await transactions.deleteOne({ _id: payment._id, userId: auth.userId, status: "pending" });
  await wishes.updateOne({ _id: wish._id, userId: auth.userId }, { $set: { status: "idea", transactionId: null, updatedAt: new Date() } });
  refresh();
  return ok("Nicht mehr eingeplant");
}

const boughtSchema = z.object({
  id: z.string(),
  book: z.boolean(),
  amount: positiveAmount,
  date: isoDate,
  accountId: optionalId,
});

export type BoughtInput = z.input<typeof boughtSchema>;

/**
 * Gekauft. Mit `book` wird die Ausgabe gebucht (die geplante Zahlung, sonst
 * eine neue). Ohne `book` wird nur markiert und eine geplante Zahlung
 * entfernt - fuer den Fall, dass die Ausgabe ueber den Kontoimport kommt.
 */
export async function markWishBought(input: BoughtInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = boughtSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, book, amount, accountId } = parsed.data;

  const wish = await findWish(auth.userId, id);
  if (!wish) return fail("Wunsch nicht gefunden");
  const today = todayIn((await getSettings(auth.userId)).timeZone);
  const date = parsed.data.date > today ? today : parsed.data.date;
  const payment = await pendingPayment(auth.userId, wish);

  if (!book) {
    if (payment) await transactions.deleteOne({ _id: payment._id, userId: auth.userId, status: "pending" });
    await wishes.updateOne({ _id: wish._id, userId: auth.userId }, { $set: { status: "bought", transactionId: null, updatedAt: new Date() } });
    refresh();
    return ok("Als gekauft markiert – die Ausgabe kommt mit dem Kontoimport");
  }

  const account = accountId ?? payment?.accountId ?? null;
  if (!account) return fail("Bitte ein Konto wählen");
  if (!(await ownsAccount(auth.userId, account))) return fail("Konto nicht gefunden");

  let transactionId: string;
  if (payment) {
    await transactions.updateOne(
      { _id: payment._id, userId: auth.userId, status: "pending" },
      { $set: { status: "booked", amountCents: amount, date, accountId: account, updatedAt: new Date() } },
    );
    transactionId = payment._id.toString();
  } else {
    const { insertedId } = await transactions.insertOne({
      userId: auth.userId,
      type: "expense",
      status: "booked",
      amountCents: amount,
      date,
      title: wish.title,
      note: "Aus der Wunschliste",
      categoryId: wish.categoryId ?? null,
      accountId: account,
      transferGroupId: null,
      recurringId: null,
      recurringDue: null,
      wishId: wish._id.toString(),
      createdAt: new Date(),
    });
    transactionId = insertedId.toString();
  }
  await wishes.updateOne(
    { _id: wish._id, userId: auth.userId },
    { $set: { status: "bought", transactionId, amountCents: amount, updatedAt: new Date() } },
  );
  refresh();
  return ok("Gekauft – als Ausgabe gebucht");
}

/** Verwerfen oder wieder auf die Wunschliste setzen. */
export async function setWishStatus(id: string, status: "dropped" | "idea"): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  if (status !== "dropped" && status !== "idea") return fail("Unbekannter Status");
  const wish = await findWish(auth.userId, id);
  if (!wish) return fail("Wunsch nicht gefunden");

  const payment = await pendingPayment(auth.userId, wish);
  if (payment) await transactions.deleteOne({ _id: payment._id, userId: auth.userId, status: "pending" });
  // Eine gebuchte Ausgabe bleibt als normale Buchung bestehen
  await wishes.updateOne({ _id: wish._id, userId: auth.userId }, { $set: { status, transactionId: null, updatedAt: new Date() } });
  refresh();
  return ok(status === "dropped" ? "Verworfen" : "Wieder auf der Wunschliste");
}

export async function deleteWish(id: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const wish = await findWish(auth.userId, id);
  if (!wish) return fail("Wunsch nicht gefunden");

  const payment = await pendingPayment(auth.userId, wish);
  if (payment) await transactions.deleteOne({ _id: payment._id, userId: auth.userId, status: "pending" });
  await wishes.deleteOne({ _id: wish._id, userId: auth.userId });
  refresh();
  return ok("Wunsch gelöscht");
}

/* --------------------------------- Import --------------------------------- */

const importRowSchema = z.object({
  title: z.string().trim().min(1).max(120),
  amountCents: z.number().int().positive().max(100_000_000_00),
  targetDate: optionalIsoDate,
  priority: z.enum(["high", "normal", "low"]),
  group: optionalText(60),
  link,
  note: optionalText(500),
  category: z.string().trim().max(40).nullable(),
});

const importSchema = z
  .object({
    fileName: fileNameSchema,
    rows: z.array(importRowSchema).min(1, "Keine Zeilen ausgewählt").max(MAX_IMPORT_ROWS, `Höchstens ${MAX_IMPORT_ROWS} Zeilen pro Import`),
    /** Zeilen mit Termin direkt als geplante Zahlung anlegen. */
    planDated: z.boolean(),
    accountId: optionalId,
  })
  .refine((value) => !value.planDated || value.accountId, { message: "Bitte ein Konto wählen, um Wünsche mit Termin einzuplanen" });

export type WishImportInput = z.input<typeof importSchema>;
export type WishImportResult = { ok: true; imported: number; skipped: number; message: string } | { ok: false; error: string };

/** Welche Wuensche gibt es schon (gleiche Bezeichnung und gleicher Preis)? */
export async function findExistingWishKeys(keys: string[]): Promise<string[]> {
  const auth = await authorize();
  if ("error" in auth) return [];
  const docs = await wishes.find({ userId: auth.userId }, { projection: { title: 1, amountCents: 1 } }).toArray();
  const existing = new Set(docs.map((doc) => wishKey(doc.title, doc.amountCents)));
  return keys.filter((key) => typeof key === "string" && existing.has(key)).slice(0, MAX_IMPORT_ROWS);
}

export async function importWishes(input: WishImportInput): Promise<WishImportResult> {
  const auth = await authorize("import");
  if ("error" in auth) return auth.error as WishImportResult;
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error)) as WishImportResult;
  const { fileName, planDated, accountId } = parsed.data;
  if (planDated && !(await ownsAccount(auth.userId, accountId))) return { ok: false, error: "Konto nicht gefunden" };
  await ensureIndexes();

  // Doppelte gegen vorhandene Wuensche: jeder vorhandene deckt eine Zeile ab
  const existing = await wishes.find({ userId: auth.userId }, { projection: { title: 1, amountCents: 1 } }).toArray();
  const remaining = new Map<string, number>();
  for (const doc of existing) {
    const key = wishKey(doc.title, doc.amountCents);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const rows = parsed.data.rows.filter((row) => {
    const key = wishKey(row.title, row.amountCents);
    const left = remaining.get(key) ?? 0;
    if (left > 0) remaining.set(key, left - 1);
    return left === 0;
  });
  const skipped = parsed.data.rows.length - rows.length;
  if (rows.length === 0) return { ok: true, imported: 0, skipped, message: "Alle Wünsche sind schon vorhanden" };

  const expenseCategories = await categories.find({ userId: auth.userId, kind: "expense" }).toArray();
  const categoryId = (name: string | null) =>
    name ? expenseCategories.find((doc) => doc.name.toLowerCase() === name.toLowerCase())?._id.toString() ?? null : null;

  const now = new Date();
  const importId = randomUUID();
  const dates = rows.map((row) => row.targetDate).filter((date): date is string => Boolean(date)).sort();
  await imports.insertOne({
    _id: importId,
    userId: auth.userId,
    kind: "wishes",
    fileName,
    accountId: planDated ? accountId : null,
    rowCount: rows.length,
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
    createdAt: now,
    undoneAt: null,
  });

  try {
    const docs: WishDoc[] = rows.map((row) => ({
      userId: auth.userId,
      title: row.title,
      amountCents: row.amountCents,
      targetDate: row.targetDate,
      status: "idea",
      priority: row.priority,
      group: row.group,
      link: row.link,
      note: row.note,
      categoryId: categoryId(row.category),
      transactionId: null,
      importId,
      importHash: wishKey(row.title, row.amountCents),
      createdAt: now,
    }));
    const { insertedIds } = await wishes.insertMany(docs);

    if (planDated && accountId) {
      for (const [index, doc] of docs.entries()) {
        if (!doc.targetDate) continue;
        const wishId = insertedIds[index].toString();
        const { insertedId } = await transactions.insertOne({
          userId: auth.userId,
          type: "expense",
          status: "pending",
          amountCents: doc.amountCents,
          date: doc.targetDate,
          title: doc.title,
          note: "Aus der Wunschliste",
          categoryId: doc.categoryId,
          accountId,
          transferGroupId: null,
          recurringId: null,
          recurringDue: null,
          wishId,
          createdAt: now,
        });
        await wishes.updateOne({ _id: insertedIds[index], userId: auth.userId }, { $set: { status: "planned", transactionId: insertedId.toString() } });
      }
    }
  } catch (error) {
    const created = await wishes.find({ userId: auth.userId, importId }, { projection: { _id: 1 } }).toArray();
    await transactions.deleteMany({ userId: auth.userId, wishId: { $in: created.map((doc) => doc._id.toString()) }, status: "pending" });
    await wishes.deleteMany({ userId: auth.userId, importId });
    await imports.deleteOne({ _id: importId, userId: auth.userId });
    throw error;
  }

  refresh();
  const message = `${rows.length} Wünsche importiert${skipped ? `, ${skipped} schon vorhanden` : ""}`;
  return { ok: true, imported: rows.length, skipped, message };
}
