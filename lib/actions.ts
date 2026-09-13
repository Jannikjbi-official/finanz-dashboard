"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  categories,
  ensureIndexes,
  recurring,
  toObjectId,
  transactions,
} from "./mongo";
import { requireUser } from "./session";
import { advance, nextDueFrom, todayISO } from "./dates";
import { parseAmountToCents } from "./money";

export type ActionState = { ok: boolean; error?: string; message?: string };

function fail(error: string): ActionState {
  return { ok: false, error };
}

function done(message: string): ActionState {
  return { ok: true, message };
}

function refresh() {
  revalidatePath("/", "layout");
}

const kind = z.enum(["income", "expense"]);
const interval = z.enum(["weekly", "monthly", "quarterly", "yearly"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum");

function amountFrom(value: FormDataEntryValue | null) {
  const cents = parseAmountToCents(String(value ?? ""));
  if (cents === null || cents <= 0) return null;
  return cents;
}

function categoryIdFrom(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "none") return null;
  return toObjectId(raw) ? raw : null;
}

/* ------------------------------- Kategorien ------------------------------- */

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(40),
  kind,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Farbe ungültig"),
  icon: z.string().trim().max(8),
});

export async function saveCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  await ensureIndexes();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    color: formData.get("color") || "#6366f1",
    icon: formData.get("icon") ?? "",
  });

  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const budgetRaw = String(formData.get("budget") ?? "").trim();
  const budgetCents = budgetRaw ? parseAmountToCents(budgetRaw) : null;

  const id = String(formData.get("id") ?? "").trim();
  const payload = { ...parsed.data, budgetCents };

  try {
    if (id) {
      const objectId = toObjectId(id);
      if (!objectId) return fail("Kategorie nicht gefunden");

      await categories.updateOne(
        { _id: objectId, userId: user.id },
        { $set: payload },
      );
    } else {
      await categories.insertOne({
        ...payload,
        userId: user.id,
        createdAt: new Date(),
      });
    }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return fail("Diese Kategorie gibt es schon");
    }
    throw error;
  }

  refresh();
  return done(id ? "Kategorie aktualisiert" : "Kategorie angelegt");
}

export async function deleteCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Kategorie nicht gefunden");

  const id = objectId.toString();
  await categories.deleteOne({ _id: objectId, userId: user.id });
  await transactions.updateMany(
    { userId: user.id, categoryId: id },
    { $set: { categoryId: null } },
  );
  await recurring.updateMany(
    { userId: user.id, categoryId: id },
    { $set: { categoryId: null } },
  );

  refresh();
  return done("Kategorie gelöscht");
}

/* ------------------------------- Buchungen -------------------------------- */

export async function saveTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  await ensureIndexes();

  const type = kind.safeParse(formData.get("type"));
  if (!type.success) return fail("Typ fehlt");

  const amountCents = amountFrom(formData.get("amount"));
  if (amountCents === null) return fail("Betrag ungültig");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return fail("Bezeichnung fehlt");

  const date = isoDate.safeParse(formData.get("date"));
  if (!date.success) return fail("Datum ungültig");

  const payload = {
    type: type.data,
    amountCents,
    title: title.slice(0, 80),
    note: String(formData.get("note") ?? "").trim().slice(0, 300) || null,
    date: date.data,
    categoryId: categoryIdFrom(formData.get("categoryId")),
  };

  const id = String(formData.get("id") ?? "").trim();

  if (id) {
    const objectId = toObjectId(id);
    if (!objectId) return fail("Buchung nicht gefunden");
    await transactions.updateOne(
      { _id: objectId, userId: user.id },
      { $set: payload },
    );
  } else {
    await transactions.insertOne({
      ...payload,
      userId: user.id,
      recurringId: null,
      createdAt: new Date(),
    });
  }

  refresh();
  return done(id ? "Buchung aktualisiert" : "Buchung gespeichert");
}

export async function deleteTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Buchung nicht gefunden");

  await transactions.deleteOne({ _id: objectId, userId: user.id });
  refresh();
  return done("Buchung gelöscht");
}

/* --------------------------- Abos / Regelmäßig --------------------------- */

export async function saveRecurring(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  await ensureIndexes();

  const type = kind.safeParse(formData.get("type"));
  if (!type.success) return fail("Typ fehlt");

  const intervalParsed = interval.safeParse(formData.get("interval"));
  if (!intervalParsed.success) return fail("Intervall fehlt");

  const amountCents = amountFrom(formData.get("amount"));
  if (amountCents === null) return fail("Betrag ungültig");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return fail("Bezeichnung fehlt");

  const startDate = isoDate.safeParse(formData.get("startDate"));
  if (!startDate.success) return fail("Startdatum ungültig");

  const payload = {
    type: type.data,
    interval: intervalParsed.data,
    amountCents,
    title: title.slice(0, 80),
    note: String(formData.get("note") ?? "").trim().slice(0, 300) || null,
    startDate: startDate.data,
    nextDue: nextDueFrom(startDate.data, intervalParsed.data),
    categoryId: categoryIdFrom(formData.get("categoryId")),
    active: formData.get("active") !== "false",
  };

  const id = String(formData.get("id") ?? "").trim();

  if (id) {
    const objectId = toObjectId(id);
    if (!objectId) return fail("Eintrag nicht gefunden");
    await recurring.updateOne(
      { _id: objectId, userId: user.id },
      { $set: payload },
    );
  } else {
    await recurring.insertOne({
      ...payload,
      userId: user.id,
      createdAt: new Date(),
    });
  }

  refresh();
  return done(id ? "Abo aktualisiert" : "Abo angelegt");
}

export async function toggleRecurring(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Eintrag nicht gefunden");

  const entry = await recurring.findOne({ _id: objectId, userId: user.id });
  if (!entry) return fail("Eintrag nicht gefunden");

  await recurring.updateOne(
    { _id: objectId, userId: user.id },
    { $set: { active: !entry.active } },
  );

  refresh();
  return done(entry.active ? "Abo pausiert" : "Abo wieder aktiv");
}

export async function deleteRecurring(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Eintrag nicht gefunden");

  await recurring.deleteOne({ _id: objectId, userId: user.id });
  refresh();
  return done("Abo gelöscht");
}

/** Fällige Zahlung als echte Buchung übernehmen. */
export async function bookRecurring(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Eintrag nicht gefunden");

  const entry = await recurring.findOne({ _id: objectId, userId: user.id });
  if (!entry) return fail("Eintrag nicht gefunden");

  const today = todayISO();
  const bookedDate = entry.nextDue > today ? today : entry.nextDue;

  await transactions.insertOne({
    userId: user.id,
    type: entry.type,
    amountCents: entry.amountCents,
    title: entry.title,
    note: entry.note ?? null,
    date: bookedDate,
    categoryId: entry.categoryId ?? null,
    recurringId: entry._id.toString(),
    createdAt: new Date(),
  });

  await recurring.updateOne(
    { _id: objectId, userId: user.id },
    { $set: { nextDue: advance(entry.nextDue, entry.interval) } },
  );

  refresh();
  return done("Als Buchung übernommen");
}
