"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { reopenDue } from "../../domain/recurring";
import { categorize } from "../../domain/rules";
import { loadRules, toRecurring } from "../data";
import { accounts, ensureIndexes, recurring, toObjectId, transactions, type TransactionDoc } from "../db";
import { getSettings } from "../user-data";
import { todayIn } from "../../domain/calendar";
import {
  authorize,
  fail,
  firstIssue,
  isoDate,
  ok,
  optionalId,
  optionalText,
  ownsAccount,
  ownsCategory,
  positiveAmount,
  refresh,
  text,
  type ActionResult,
} from "./shared";

const transactionSchema = z.object({
  id: optionalId,
  type: z.enum(["income", "expense"], { message: "Bitte Einnahme oder Ausgabe wählen" }),
  status: z.enum(["booked", "pending"]),
  amount: positiveAmount,
  date: isoDate,
  title: text(120, "Bitte eine Beschreibung angeben"),
  note: optionalText(500),
  categoryId: optionalId,
  accountId: z.string({ message: "Bitte ein Konto wählen" }).min(1, "Bitte ein Konto wählen"),
});

export type TransactionInput = z.input<typeof transactionSchema>;

export async function saveTransaction(input: TransactionInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;

  if (!(await ownsAccount(auth.userId, data.accountId, { allowArchived: Boolean(data.id) }))) return fail("Konto nicht gefunden");
  if (!(await ownsCategory(auth.userId, data.categoryId))) return fail("Kategorie nicht gefunden");
  await ensureIndexes();

  const fields = {
    type: data.type,
    status: data.status,
    amountCents: data.amount,
    date: data.date,
    title: data.title,
    note: data.note,
    categoryId: data.categoryId,
    accountId: data.accountId,
    updatedAt: new Date(),
  };

  if (data.id) {
    const _id = toObjectId(data.id);
    if (!_id) return fail("Buchung nicht gefunden");
    const existing = await transactions.findOne({ _id, userId: auth.userId }, { projection: { transferGroupId: 1 } });
    if (!existing) return fail("Buchung nicht gefunden");
    if (existing.transferGroupId) return fail("Transfers bitte über „Transfer“ löschen und neu anlegen.");
    // Unscharfe Altdaten werden beim Bearbeiten zu einem festen Datum
    await transactions.updateOne({ _id, userId: auth.userId }, { $set: { ...fields, dateEnd: null, datePrecision: "day" } });
    refresh();
    return ok("Änderungen gespeichert");
  }

  // Ohne Kategorie: Kategorisierungsregeln fragen
  if (!fields.categoryId) {
    fields.categoryId = categorize({ title: fields.title, note: fields.note, type: fields.type, accountId: fields.accountId }, await loadRules(auth.userId));
  }
  await transactions.insertOne({
    ...fields,
    userId: auth.userId,
    transferGroupId: null,
    recurringId: null,
    recurringDue: null,
    createdAt: new Date(),
  });
  refresh();
  return ok(data.type === "income" ? "Einnahme erfasst" : "Ausgabe erfasst");
}

/** Geplant -> bezahlt bzw. erwartet -> eingegangen (und zurueck). */
export async function setTransactionStatus(id: string, status: "booked" | "pending"): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(id);
  if (!_id || !["booked", "pending"].includes(status)) return fail("Buchung nicht gefunden");

  const existing = await transactions.findOne({ _id, userId: auth.userId });
  if (!existing || existing.transferGroupId) return fail("Buchung nicht gefunden");

  const update: Partial<TransactionDoc> = { status, updatedAt: new Date() };
  if (status === "booked") {
    // Frueher bezahlt als geplant: Buchungsdatum ist heute, nie in der Zukunft
    const today = todayIn((await getSettings(auth.userId)).timeZone);
    if (existing.date > today) update.date = today;
  }
  await transactions.updateOne({ _id, userId: auth.userId }, { $set: update });
  refresh();
  return ok(
    status === "booked"
      ? existing.type === "income" ? "Als eingegangen markiert" : "Als bezahlt markiert"
      : "Wieder offen",
  );
}

/**
 * Loescht eine Buchung. War sie die Zahlung des zuletzt erledigten Termins
 * einer regelmaessigen Zahlung, wird dieser Termin wieder offen - sonst
 * wuerde er weder als bezahlt noch als offen zaehlen.
 */
export async function deleteTransaction(id: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(id);
  if (!_id) return fail("Buchung nicht gefunden");

  const existing = await transactions.findOne({ _id, userId: auth.userId });
  if (!existing) return fail("Buchung nicht gefunden");

  if (existing.transferGroupId) {
    await transactions.deleteMany({ userId: auth.userId, transferGroupId: existing.transferGroupId });
    refresh();
    return ok("Transfer gelöscht");
  }

  await transactions.deleteOne({ _id, userId: auth.userId });

  const recurringId = toObjectId(existing.recurringId);
  if (recurringId && existing.recurringDue) {
    const doc = await recurring.findOne({ _id: recurringId, userId: auth.userId });
    if (doc) {
      const entry = toRecurring(doc);
      const reopened = reopenDue(entry, existing.recurringDue);
      if (reopened) {
        await recurring.updateOne(
          { _id: recurringId, userId: auth.userId, nextDue: entry.nextDue },
          { $set: { nextDue: reopened, updatedAt: new Date() } },
        );
      }
    }
  }

  refresh();
  return ok("Buchung gelöscht");
}

const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, "Bitte das Quellkonto wählen"),
    toAccountId: z.string().min(1, "Bitte das Zielkonto wählen"),
    amount: positiveAmount,
    date: isoDate,
    note: optionalText(300),
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, "Quell- und Zielkonto müssen verschieden sein");

export type TransferInput = z.input<typeof transferSchema>;

/**
 * Transfer zwischen eigenen Konten: zwei verknuepfte Buchungen mit gleicher
 * transferGroupId. Sie veraendern beide Kontostaende, zaehlen aber nie als
 * Einnahme oder Ausgabe.
 */
export async function saveTransfer(input: TransferInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;

  const from = toObjectId(data.fromAccountId);
  const to = toObjectId(data.toAccountId);
  if (!from || !to) return fail("Konto nicht gefunden");
  const owned = await accounts.find({ _id: { $in: [from, to] }, userId: auth.userId, archived: false }).toArray();
  if (owned.length !== 2) return fail("Konto nicht gefunden");
  const name = (id: string) => owned.find((doc) => doc._id.toString() === id)!.name;

  const transferGroupId = randomUUID();
  const now = new Date();
  const base = {
    userId: auth.userId,
    status: "booked" as const,
    amountCents: data.amount,
    date: data.date,
    note: data.note,
    categoryId: null,
    recurringId: null,
    recurringDue: null,
    transferGroupId,
    createdAt: now,
  };
  await transactions.insertMany([
    { ...base, type: "expense", accountId: data.fromAccountId, title: `Transfer an ${name(data.toAccountId)}` },
    { ...base, type: "income", accountId: data.toAccountId, title: `Transfer von ${name(data.fromAccountId)}` },
  ]);
  refresh();
  return ok("Transfer gebucht");
}
