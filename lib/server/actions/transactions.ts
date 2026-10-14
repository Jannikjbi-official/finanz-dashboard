"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { categorize } from "../../domain/rules";
import { loadRules } from "../data";
import { accounts, categories, ensureIndexes, toObjectId, transactions, type TransactionDoc } from "../db";
import { purgeTrash, restoreTrash, trashTransactions } from "../trash";
import { getSettings } from "../user-data";
import { todayIn } from "../../domain/calendar";
import { formatMoney } from "../../format";
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
 * Loescht eine Buchung (bei Transfers beide Seiten) in den Papierkorb. War
 * sie die Zahlung eines erledigten Termins, wird der Termin wieder offen.
 */
export async function deleteTransaction(id: string): Promise<ActionResult> {
  return deleteTransactions([id]);
}

const idsSchema = z.array(z.string()).min(1, "Keine Buchung ausgewählt").max(1000, "Bitte höchstens 1.000 Buchungen auf einmal");

/** Mehrere Buchungen in den Papierkorb; Transfers immer mit beiden Seiten. */
export async function deleteTransactions(ids: string[]): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const objectIds = parsed.data.map(toObjectId).filter((value) => value !== null);

  const selected = await transactions.find({ _id: { $in: objectIds }, userId: auth.userId }).toArray();
  if (selected.length === 0) return fail("Buchung nicht gefunden");
  const groups = [...new Set(selected.map((doc) => doc.transferGroupId).filter((group): group is string => Boolean(group)))];
  const partners = groups.length
    ? await transactions.find({ userId: auth.userId, transferGroupId: { $in: groups }, _id: { $nin: selected.map((doc) => doc._id) } }).toArray()
    : [];

  const result = await trashTransactions(auth.userId, [...selected, ...partners]);
  refresh();
  const single = selected.length === 1 || (selected.length + partners.length === 2 && groups.length === 1);
  const message = single ? (groups.length ? "Transfer gelöscht" : "Buchung gelöscht") : `${result?.deleted ?? 0} Buchungen gelöscht`;
  return ok(message, result?.trashId);
}

const bulkSchema = z.object({
  ids: idsSchema,
  // undefined: unveraendert, null: Kategorie entfernen
  categoryId: z.string().min(1).nullable().optional(),
  accountId: z.string().min(1).optional(),
  booked: z.literal(true).optional(),
});

export type BulkUpdateInput = z.input<typeof bulkSchema>;

/**
 * Mehrere Buchungen auf einmal aendern: Kategorie, Konto oder "bezahlt".
 * Transfers bleiben unberuehrt; eine Kategorie gilt nur fuer Buchungen
 * ihrer Art (Ausgabe-Kategorie nur fuer Ausgaben).
 */
export async function updateTransactions(input: BulkUpdateInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { ids, categoryId, accountId, booked } = parsed.data;
  const base = {
    _id: { $in: ids.map(toObjectId).filter((value) => value !== null) },
    userId: auth.userId,
    transferGroupId: { $in: [null] },
  };
  const now = new Date();

  if (categoryId !== undefined) {
    if (categoryId === null) {
      const { modifiedCount } = await transactions.updateMany(base, { $set: { categoryId: null, updatedAt: now } });
      refresh();
      return ok(`Kategorie bei ${modifiedCount} Buchungen entfernt`);
    }
    const category = await categories.findOne({ _id: toObjectId(categoryId)!, userId: auth.userId });
    if (!category) return fail("Kategorie nicht gefunden");
    const { modifiedCount, matchedCount } = await transactions.updateMany({ ...base, type: category.kind }, { $set: { categoryId, updatedAt: now } });
    const skipped = (await transactions.countDocuments(base)) - matchedCount;
    refresh();
    return ok(
      `Kategorie „${category.name}“ bei ${modifiedCount} Buchungen gesetzt` +
        (skipped > 0 ? `, ${skipped} übersprungen (${category.kind === "expense" ? "keine Ausgabe" : "keine Einnahme"})` : ""),
    );
  }

  if (accountId !== undefined) {
    if (!(await ownsAccount(auth.userId, accountId))) return fail("Konto nicht gefunden");
    const { modifiedCount } = await transactions.updateMany(base, { $set: { accountId, updatedAt: now } });
    refresh();
    return ok(`${modifiedCount} Buchungen verschoben`);
  }

  if (booked) {
    const today = todayIn((await getSettings(auth.userId)).timeZone);
    const pending = { ...base, status: "pending" as const };
    // Frueher bezahlt als geplant: Buchungsdatum ist heute, nie in der Zukunft
    const future = await transactions.updateMany({ ...pending, date: { $gt: today } }, { $set: { status: "booked", date: today, updatedAt: now } });
    const due = await transactions.updateMany(pending, { $set: { status: "booked", updatedAt: now } });
    refresh();
    return ok(`${future.modifiedCount + due.modifiedCount} Buchungen als bezahlt bzw. eingegangen markiert`);
  }

  return fail("Nichts zu ändern");
}

/** Einen Papierkorb-Eintrag zurueckholen (auch aus dem Toast "Rückgängig"). */
export async function restoreFromTrash(trashId: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  if (typeof trashId !== "string") return fail("Eintrag nicht gefunden");
  const result = await restoreTrash(auth.userId, trashId);
  if (!result.ok) return fail(result.error);
  refresh();
  const parts = [result.restored === 1 ? "Buchung wiederhergestellt" : `${result.restored} Buchungen wiederhergestellt`];
  if (result.unlinked > 0) parts.push(`${result.unlinked} ohne Zuordnung zur regelmäßigen Zahlung (Termin inzwischen anders erledigt)`);
  return ok(parts.join(", "));
}

/** Endgueltig loeschen: ein Eintrag oder der ganze Papierkorb (ohne ID). */
export async function purgeFromTrash(trashId?: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  if (trashId !== undefined && typeof trashId !== "string") return fail("Eintrag nicht gefunden");
  const deleted = await purgeTrash(auth.userId, trashId);
  refresh();
  if (trashId === undefined) return ok(deleted ? "Papierkorb geleert" : "Der Papierkorb ist schon leer");
  return deleted ? ok("Endgültig gelöscht") : fail("Eintrag nicht gefunden");
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

const splitSchema = z.object({
  id: z.string().min(1),
  parts: z
    .array(
      z.object({
        amount: positiveAmount,
        title: optionalText(120),
        categoryId: optionalId,
      }),
    )
    .min(2, "Mindestens zwei Teile")
    .max(20, "Höchstens 20 Teile"),
});

export type SplitInput = z.input<typeof splitSchema>;

/**
 * Buchung in Teile mit eigener Kategorie aufteilen. Die Buchung selbst wird
 * Teil 1 (behaelt ID, Import-Kennung und Dublettenschutz), die weiteren
 * Teile kommen hinzu. Die Summe muss genau dem Betrag entsprechen.
 */
export async function splitTransaction(input: SplitInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = splitSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const _id = toObjectId(parsed.data.id);
  if (!_id) return fail("Buchung nicht gefunden");
  const doc = await transactions.findOne({ _id, userId: auth.userId });
  if (!doc) return fail("Buchung nicht gefunden");
  if (doc.transferGroupId) return fail("Transfers lassen sich nicht aufteilen.");
  if (doc.recurringId) return fail("Die Buchung ist einer regelmäßigen Zahlung zugeordnet – bitte zuerst die Zuordnung lösen.");
  if (doc.splitGroupId) return fail("Die Buchung ist schon aufgeteilt.");

  const parts = parsed.data.parts;
  const sum = parts.reduce((total, part) => total + part.amount, 0);
  if (sum !== doc.amountCents) return fail(`Die Teile ergeben ${formatMoney(sum)}, die Buchung hat ${formatMoney(doc.amountCents)}.`);
  for (const part of parts) {
    if (!(await ownsCategory(auth.userId, part.categoryId))) return fail("Kategorie nicht gefunden");
  }

  const group = doc._id.toString();
  const now = new Date();
  const [first, ...rest] = parts;
  // Erst Teil 1 an den unveraenderten Zustand binden: ein zweiter Klick teilt nichts doppelt
  const updated = await transactions.updateOne(
    { _id, userId: auth.userId, amountCents: doc.amountCents, splitGroupId: { $in: [null] } },
    {
      $set: {
        amountCents: first.amount,
        title: first.title || doc.title,
        categoryId: first.categoryId,
        splitGroupId: group,
        splitOriginal: { title: doc.title, amountCents: doc.amountCents, categoryId: doc.categoryId },
        updatedAt: now,
      },
    },
  );
  if (updated.modifiedCount === 0) return fail("Die Buchung wurde inzwischen geändert.");
  await transactions.insertMany(
    rest.map((part) => ({
      userId: auth.userId,
      type: doc.type,
      status: doc.status,
      amountCents: part.amount,
      date: doc.date,
      title: part.title || doc.title,
      note: doc.note ?? null,
      categoryId: part.categoryId,
      accountId: doc.accountId ?? null,
      transferGroupId: null,
      recurringId: null,
      recurringDue: null,
      bankPending: doc.bankPending ?? false,
      splitGroupId: group,
      createdAt: now,
    })),
  );
  refresh();
  return ok(`In ${parts.length} Teile aufgeteilt`);
}

/** Aufteilung aufheben: Teil 1 bekommt Titel, Kategorie und die Summe aller Teile zurueck. */
export async function unsplitTransaction(id: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(id);
  if (!_id) return fail("Buchung nicht gefunden");
  const doc = await transactions.findOne({ _id, userId: auth.userId });
  if (!doc?.splitGroupId) return fail("Die Buchung ist nicht aufgeteilt.");

  const group = doc.splitGroupId;
  const parts = await transactions.find({ userId: auth.userId, splitGroupId: group }).toArray();
  const main = parts.find((part) => part._id.toString() === group);
  if (!main) return fail("Teil 1 der Aufteilung fehlt – bitte die Teile einzeln bearbeiten.");
  const others = parts.filter((part) => part !== main);
  const total = parts.reduce((sum, part) => sum + part.amountCents, 0);

  await transactions.updateOne(
    { _id: main._id, userId: auth.userId },
    {
      $set: {
        amountCents: total,
        title: main.splitOriginal ? main.splitOriginal.title : main.title,
        // "ohne Kategorie" (null) muss erhalten bleiben
        categoryId: main.splitOriginal ? main.splitOriginal.categoryId : main.categoryId,
        splitGroupId: null,
        splitOriginal: null,
        updatedAt: new Date(),
      },
    },
  );
  if (others.length > 0) await transactions.deleteMany({ userId: auth.userId, _id: { $in: others.map((part) => part._id) } });
  refresh();
  return ok("Aufteilung aufgehoben");
}
