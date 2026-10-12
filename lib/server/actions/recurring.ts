"use server";

import { z } from "zod";
import { todayIn } from "../../domain/calendar";
import { settleDue } from "../../domain/recurring";
import { firstOccurrenceFrom } from "../../domain/schedule";
import type { RecurringStatus } from "../../domain/types";
import { toRecurring } from "../data";
import { ensureIndexes, recurring, toObjectId, transactions, type RecurringDoc } from "../db";
import { getSettings } from "../user-data";
import {
  authorize,
  fail,
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

const recurringSchema = z
  .object({
    id: optionalId,
    type: z.enum(["income", "expense"]),
    title: text(80, "Bitte einen Namen angeben"),
    provider: optionalText(80),
    amount: positiveAmount,
    interval: z.enum(["weekly", "monthly", "quarterly", "yearly"], { message: "Bitte ein Intervall wählen" }),
    nextDue: isoDate,
    costType: z.enum(["rent", "energy", "internet", "phone", "insurance", "subscription", "loan", "other"]),
    categoryId: optionalId,
    accountId: optionalId,
    endDate: optionalIsoDate,
    cancelledOn: optionalIsoDate,
    noticeValue: z
      .string()
      .nullish()
      .transform((value) => (value && value.trim() ? Number(value) : null))
      .refine((value) => value === null || (Number.isInteger(value) && value > 0 && value <= 365), "Kündigungsfrist ungültig"),
    noticeUnit: z.enum(["days", "weeks", "months"]).nullish(),
    note: optionalText(500),
  })
  .refine((value) => !value.endDate || value.endDate >= value.nextDue || value.cancelledOn !== null, {
    message: "Das Vertragsende liegt vor dem nächsten Zahlungstermin",
  });

export type RecurringInput = z.input<typeof recurringSchema>;

export async function saveRecurring(input: RecurringInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;

  if (!(await ownsAccount(auth.userId, data.accountId, { allowArchived: Boolean(data.id) }))) return fail("Konto nicht gefunden");
  if (!(await ownsCategory(auth.userId, data.categoryId))) return fail("Kategorie nicht gefunden");
  await ensureIndexes();

  const fields = {
    type: data.type,
    title: data.title,
    provider: data.provider,
    amountCents: data.amount,
    interval: data.interval,
    nextDue: data.nextDue,
    costType: data.type === "income" ? ("other" as const) : data.costType,
    categoryId: data.categoryId,
    accountId: data.accountId,
    endDate: data.endDate,
    cancelledOn: data.cancelledOn,
    noticePeriod: data.noticeValue && data.noticeUnit ? { value: data.noticeValue, unit: data.noticeUnit } : null,
    note: data.note,
    updatedAt: new Date(),
  };

  if (data.id) {
    const _id = toObjectId(data.id);
    const existing = _id ? await recurring.findOne({ _id, userId: auth.userId }) : null;
    if (!_id || !existing) return fail("Eintrag nicht gefunden");
    // Neuer Termin = neuer Ankertag. Unveraendert bleibt der alte (z. B. der 31.).
    const startDate = existing.nextDue === data.nextDue ? existing.startDate : data.nextDue;
    await recurring.updateOne({ _id, userId: auth.userId }, { $set: { ...fields, startDate } });
    refresh();
    return ok("Änderungen gespeichert");
  }

  await recurring.insertOne({
    ...fields,
    userId: auth.userId,
    startDate: data.nextDue,
    status: "active",
    active: true,
    createdAt: new Date(),
  });
  refresh();
  return ok(data.costType === "subscription" && data.type === "expense" ? "Abonnement angelegt" : "Regelmäßige Zahlung angelegt");
}

const statusSchema = z.object({
  id: z.string(),
  status: z.enum(["active", "paused", "cancelled", "archived"]),
  cancelledOn: optionalIsoDate,
  endDate: optionalIsoDate,
});

export type RecurringStatusInput = z.input<typeof statusSchema>;

/**
 * Pausieren, Kuendigen, Archivieren, Reaktivieren. Beim Reaktivieren werden
 * Termine aus der Pause nicht nachtraeglich faellig: es geht beim naechsten
 * planmaessigen Termin ab heute weiter.
 */
export async function setRecurringStatus(input: RecurringStatusInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, status, cancelledOn, endDate } = parsed.data;

  const _id = toObjectId(id);
  const doc = _id ? await recurring.findOne({ _id, userId: auth.userId }) : null;
  if (!_id || !doc) return fail("Eintrag nicht gefunden");
  const entry = toRecurring(doc);

  const update: Partial<RecurringDoc> = { status, active: status === "active", updatedAt: new Date() };

  if (status === "cancelled") {
    update.cancelledOn = cancelledOn ?? todayIn((await getSettings(auth.userId)).timeZone);
    update.endDate = endDate;
  }
  if (status === "active" && entry.status !== "active") {
    const today = todayIn((await getSettings(auth.userId)).timeZone);
    if (entry.nextDue < today) update.nextDue = firstOccurrenceFrom(entry.startDate, entry.interval, today);
    if (entry.status === "cancelled") update.cancelledOn = null;
  }

  await recurring.updateOne({ _id, userId: auth.userId }, { $set: update });
  refresh();
  const messages: Record<RecurringStatus, string> = {
    active: "Wieder aktiv",
    paused: "Pausiert – es werden keine Zahlungen mehr eingeplant",
    cancelled: endDate ? "Als gekündigt markiert" : "Als gekündigt markiert – keine weiteren Zahlungen eingeplant",
    archived: "Archiviert",
  };
  return ok(messages[status]);
}

const settleSchema = z.object({
  id: z.string(),
  due: isoDate,
  mode: z.enum(["book", "skip"]),
  date: optionalIsoDate,
  amount: z.string().nullish(),
  accountId: optionalId,
});

export type SettleInput = z.input<typeof settleSchema>;

/**
 * Einen Termin erledigen.
 * - book: als bezahlt/eingegangen buchen (Buchung entsteht, Termin rueckt weiter)
 * - skip: nur weiterruecken, z. B. wenn die Zahlung schon per CSV importiert
 *   wurde oder ausgefallen ist
 *
 * Nur der naechste offene Termin kann erledigt werden; die Aktualisierung ist
 * an den erwarteten Termin gebunden, ein doppelter Klick bucht nicht doppelt.
 */
export async function settleRecurring(input: SettleInput): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const parsed = settleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;

  const _id = toObjectId(data.id);
  const doc = _id ? await recurring.findOne({ _id, userId: auth.userId }) : null;
  if (!_id || !doc) return fail("Eintrag nicht gefunden");
  const entry = toRecurring(doc);

  const next = settleDue(entry, data.due);
  if (!next) return fail("Dieser Termin wurde bereits erledigt. Die Ansicht wird aktualisiert.");

  let amountCents = entry.amountCents;
  if (data.mode === "book" && data.amount) {
    const parsedAmount = positiveAmount.safeParse(data.amount);
    if (!parsedAmount.success) return fail(firstIssue(parsedAmount.error));
    amountCents = parsedAmount.data;
  }
  const accountId = data.accountId ?? entry.accountId;
  if (data.mode === "book") {
    if (!accountId) return fail("Bitte ein Konto wählen, von dem gezahlt wurde");
    if (!(await ownsAccount(auth.userId, accountId))) return fail("Konto nicht gefunden");
  }

  const moved = await recurring.updateOne(
    { _id, userId: auth.userId, nextDue: data.due },
    { $set: { nextDue: next, updatedAt: new Date() } },
  );
  if (moved.modifiedCount === 0) return fail("Dieser Termin wurde bereits erledigt. Die Ansicht wird aktualisiert.");

  if (data.mode === "skip") {
    refresh();
    return ok("Termin übersprungen");
  }

  const today = todayIn((await getSettings(auth.userId)).timeZone);
  const date = data.date ?? (data.due <= today ? data.due : today);
  try {
    await ensureIndexes();
    await transactions.insertOne({
      userId: auth.userId,
      type: entry.type,
      status: "booked",
      amountCents,
      date,
      title: entry.title,
      note: null,
      categoryId: entry.categoryId,
      accountId,
      transferGroupId: null,
      recurringId: entry.id,
      recurringDue: data.due,
      createdAt: new Date(),
    });
  } catch (error) {
    // Buchung fehlgeschlagen: Termin wieder oeffnen, damit nichts verloren geht
    await recurring.updateOne({ _id, userId: auth.userId, nextDue: next }, { $set: { nextDue: data.due } });
    throw error;
  }

  refresh();
  return ok(entry.type === "income" ? "Als eingegangen gebucht" : "Als bezahlt gebucht");
}

/** Endgueltig loeschen - nur fuer archivierte Eintraege. Buchungen bleiben. */
export async function deleteRecurring(id: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const _id = toObjectId(id);
  if (!_id) return fail("Eintrag nicht gefunden");
  const result = await recurring.deleteOne({ _id, userId: auth.userId, status: "archived" });
  if (result.deletedCount === 0) return fail("Nur archivierte Einträge können gelöscht werden");
  refresh();
  return ok("Endgültig gelöscht – bisherige Buchungen bleiben erhalten");
}

