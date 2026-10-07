"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  accounts,
  categories,
  ensureIndexes,
  goals,
  recurring,
  refunds,
  toObjectId,
  transactions,
  type AccountDoc,
} from "./mongo";
import { requireUser } from "./session";
import { advance, endOfMonth, nextDueFrom, todayISO } from "./dates";
import { parseAmountToCents } from "./money";
import { parseCsv } from "./csv";
import { ownedRefs } from "./server/ownership";
import { limitUser } from "./server/rate-limit";
import { randomUUID } from "node:crypto";

export type ActionState = { ok: boolean; error?: string; message?: string };

function fail(error: string): ActionState {
  return { ok: false, error };
}

function done(message: string): ActionState {
  return { ok: true, message };
}

/** Angemeldeten Nutzer holen und sein Schreib-Kontingent pruefen. */
async function authorize(kind: "write" | "import" = "write") {
  const user = await requireUser();
  const limit = await limitUser(user.id, kind);
  const blocked = limit.allowed
    ? null
    : fail(`Zu viele Anfragen – bitte in ${limit.retryAfterSeconds} Sekunden erneut versuchen.`);
  return { user, blocked };
}

const REF_ERROR = {
  categoryId: "Kategorie nicht gefunden",
  accountId: "Konto nicht gefunden",
} as const;

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



const datePrecision = z.enum(["day", "range", "month"]);

/**
 * Datumsangabe einer Buchung einlesen. Wer den Tag nicht kennt, gibt einen
 * Zeitraum oder gleich den ganzen Monat an - gespeichert wird immer ein
 * Startdatum, damit Monatsauswertungen weiter funktionieren.
 */
function periodFrom(formData: FormData):
  | { date: string; dateEnd: string | null; precision: "day" | "range" | "month" }
  | { error: string } {
  const precision =
    datePrecision.safeParse(formData.get("datePrecision")).data ?? "day";

  if (precision === "month") {
    const month = String(formData.get("month") ?? "").trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Monat ungültig" };
    return { date: `${month}-01`, dateEnd: endOfMonth(month), precision };
  }

  const start = isoDate.safeParse(formData.get("date"));
  if (!start.success) return { error: "Datum ungültig" };

  if (precision === "day") {
    return { date: start.data, dateEnd: null, precision };
  }

  const end = isoDate.safeParse(formData.get("dateEnd"));
  if (!end.success) return { error: "Enddatum ungültig" };
  if (end.data < start.data) return { error: "Der Zeitraum endet vor dem Start" };

  return { date: start.data, dateEnd: end.data, precision };
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
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
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
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
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
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  await ensureIndexes();

  const type = kind.safeParse(formData.get("type"));
  if (!type.success) return fail("Typ fehlt");

  const amountCents = amountFrom(formData.get("amount"));
  if (amountCents === null) return fail("Betrag ungültig");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return fail("Bezeichnung fehlt");

  const period = periodFrom(formData);
  if ("error" in period) return fail(period.error);

  const refs = await ownedRefs(user.id, {
    categoryId: { collection: "categories", raw: formData.get("categoryId") },
    accountId: { collection: "accounts", raw: formData.get("accountId") },
  });
  if (!refs.ok) return fail(REF_ERROR[refs.field]);

  const payload = {
    type: type.data,
    amountCents,
    title: title.slice(0, 80),
    note: String(formData.get("note") ?? "").trim().slice(0, 300) || null,
    date: period.date,
    dateEnd: period.dateEnd,
    datePrecision: period.precision,
    ...refs.values,
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
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Buchung nicht gefunden");

  const existing = await transactions.findOne({ _id: objectId, userId: user.id });
  if (!existing) return fail("Buchung nicht gefunden");

  // Eine Umbuchung besteht aus zwei Haelften - nie nur eine entfernen
  if (existing.transferGroupId) {
    await transactions.deleteMany({ userId: user.id, transferGroupId: existing.transferGroupId });
    refresh();
    return done("Umbuchung gelöscht");
  }

  await transactions.deleteOne({ _id: objectId, userId: user.id });
  refresh();
  return done("Buchung gelöscht");
}

/* --------------------------- Abos / Regelmäßig --------------------------- */

export async function saveRecurring(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
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

  const refs = await ownedRefs(user.id, {
    categoryId: { collection: "categories", raw: formData.get("categoryId") },
  });
  if (!refs.ok) return fail(REF_ERROR[refs.field]);

  const payload = {
    type: type.data,
    interval: intervalParsed.data,
    amountCents,
    title: title.slice(0, 80),
    note: String(formData.get("note") ?? "").trim().slice(0, 300) || null,
    startDate: startDate.data,
    nextDue: nextDueFrom(startDate.data, intervalParsed.data),
    categoryId: refs.values.categoryId,
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
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
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
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
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
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
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
    {
      $set: {
        nextDue: advance(entry.nextDue, entry.interval, Number(entry.startDate.slice(8, 10))),
      },
    },
  );

  refresh();
  return done("Als Buchung übernommen");
}

/* ------------------------------- Sparziele -------------------------------- */

export async function saveGoal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  await ensureIndexes();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return fail("Bezeichnung fehlt");

  const targetCents = amountFrom(formData.get("target"));
  if (targetCents === null) return fail("Zielbetrag ungültig");

  const savedRaw = String(formData.get("saved") ?? "").trim();
  const savedCents = savedRaw ? (parseAmountToCents(savedRaw) ?? 0) : 0;

  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const deadline = deadlineRaw && isoDate.safeParse(deadlineRaw).success
    ? deadlineRaw
    : null;

  const colorRaw = String(formData.get("color") ?? "#6366f1");
  const color = /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : "#6366f1";

  const payload = {
    title: title.slice(0, 60),
    targetCents,
    deadline,
    color,
    note: String(formData.get("note") ?? "").trim().slice(0, 200) || null,
  };

  const id = String(formData.get("id") ?? "").trim();

  if (id) {
    const objectId = toObjectId(id);
    if (!objectId) return fail("Sparziel nicht gefunden");
    await goals.updateOne({ _id: objectId, userId: user.id }, { $set: payload });
  } else {
    await goals.insertOne({
      ...payload,
      savedCents,
      userId: user.id,
      createdAt: new Date(),
    });
  }

  refresh();
  return done(id ? "Sparziel aktualisiert" : "Sparziel angelegt");
}

/** Betrag auf ein Sparziel ein- oder auszahlen. */
export async function adjustGoal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;

  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Sparziel nicht gefunden");

  const cents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (cents === null || cents === 0) return fail("Betrag ungültig");

  const direction = formData.get("direction") === "withdraw" ? -1 : 1;

  const goal = await goals.findOne({ _id: objectId, userId: user.id });
  if (!goal) return fail("Sparziel nicht gefunden");

  const next = Math.max(0, goal.savedCents + direction * cents);
  await goals.updateOne(
    { _id: objectId, userId: user.id },
    { $set: { savedCents: next } },
  );

  refresh();
  return done(direction > 0 ? "Eingezahlt" : "Entnommen");
}

export async function deleteGoal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Sparziel nicht gefunden");

  await goals.deleteOne({ _id: objectId, userId: user.id });
  refresh();
  return done("Sparziel gelöscht");
}

/** Monatsbudget einer Kategorie setzen oder entfernen. */
export async function setCategoryBudget(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;

  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Kategorie nicht gefunden");

  const raw = String(formData.get("budget") ?? "").trim();
  const budgetCents = raw ? parseAmountToCents(raw) : null;
  if (raw && budgetCents === null) return fail("Budget ungültig");

  await categories.updateOne(
    { _id: objectId, userId: user.id },
    { $set: { budgetCents } },
  );

  refresh();
  return done(budgetCents ? "Budget gesetzt" : "Budget entfernt");
}

/* --------------------------------- Konten --------------------------------- */

const accountKind = z.enum(["giro", "cash", "savings", "other"]);

export async function saveAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  await ensureIndexes();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("Name fehlt");

  const kindParsed = accountKind.safeParse(formData.get("kind"));
  if (!kindParsed.success) return fail("Kontoart fehlt");

  // Ueberzogene Konten duerfen mit negativem Stand starten
  const startRaw = String(formData.get("startBalance") ?? "").trim().replace(/^[−–]/, "-");
  const negative = startRaw.startsWith("-");
  const startAbs = startRaw ? parseAmountToCents(startRaw.replace(/^[-+]/, "")) : 0;
  if (startRaw && startAbs === null) return fail("Startsaldo ungültig");
  const startBalanceCents = (startAbs ?? 0) * (negative ? -1 : 1);

  const colorRaw = String(formData.get("color") ?? "#6366f1");

  const payload: Partial<AccountDoc> = {
    name: name.slice(0, 40),
    kind: kindParsed.data,
    startBalanceCents,
    color: /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : "#6366f1",
    icon: String(formData.get("icon") ?? "").trim().slice(0, 8),
    archived: formData.get("archived") === "true",
  };

  // Nur Formulare, die das Feld kennen, setzen "verfuegbar" - aeltere lassen es unangetastet
  if (formData.get("liquidField") === "1") {
    payload.liquid = formData.get("liquid") === "true";
  }

  const id = String(formData.get("id") ?? "").trim();

  if (id) {
    const objectId = toObjectId(id);
    if (!objectId) return fail("Konto nicht gefunden");
    await accounts.updateOne({ _id: objectId, userId: user.id }, { $set: payload });
  } else {
    await accounts.insertOne({
      ...(payload as Omit<AccountDoc, "userId" | "createdAt">),
      userId: user.id,
      createdAt: new Date(),
    });
  }

  refresh();
  return done(id ? "Konto aktualisiert" : "Konto angelegt");
}

export async function deleteAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Konto nicht gefunden");

  const id = objectId.toString();
  await accounts.deleteOne({ _id: objectId, userId: user.id });
  // Buchungen bleiben erhalten, verlieren aber die Zuordnung.
  await transactions.updateMany(
    { userId: user.id, accountId: id },
    { $set: { accountId: null } },
  );

  refresh();
  return done("Konto gelöscht");
}

/** Umbuchung zwischen zwei Konten: eine Ausgabe und eine Einnahme. */
export async function transferBetweenAccounts(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  await ensureIndexes();

  const fromId = String(formData.get("from") ?? "").trim();
  const toId = String(formData.get("to") ?? "").trim();
  if (!toObjectId(fromId) || !toObjectId(toId)) return fail("Konto fehlt");
  if (fromId === toId) return fail("Konten müssen sich unterscheiden");

  const amountCents = amountFrom(formData.get("amount"));
  if (amountCents === null) return fail("Betrag ungültig");

  const date = isoDate.safeParse(formData.get("date"));
  if (!date.success) return fail("Datum ungültig");

  const [from, to] = await Promise.all([
    accounts.findOne({ _id: toObjectId(fromId)!, userId: user.id }),
    accounts.findOne({ _id: toObjectId(toId)!, userId: user.id }),
  ]);
  if (!from || !to) return fail("Konto nicht gefunden");

  const base = {
    userId: user.id,
    amountCents,
    transferGroupId: randomUUID(),
    note: "Umbuchung",
    date: date.data,
    categoryId: null,
    recurringId: null,
    createdAt: new Date(),
  };

  await transactions.insertMany([
    { ...base, type: "expense" as const, title: `Umbuchung an ${to.name}`, accountId: fromId },
    { ...base, type: "income" as const, title: `Umbuchung von ${from.name}`, accountId: toId },
  ]);

  refresh();
  return done("Umbuchung gespeichert");
}

/* ----------------------------- Import (CSV) ------------------------------- */

export type ImportState = ActionState & {
  imported?: number;
  skipped?: number;
  createdCategories?: string[];
  problems?: Array<{ line: number; reason: string }>;
};

export async function importTransactions(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { user, blocked } = await authorize("import");
  if (blocked) return blocked;
  await ensureIndexes();

  const file = formData.get("file");
  const pasted = String(formData.get("csv") ?? "");

  const text =
    file instanceof File && file.size > 0 ? await file.text() : pasted;

  if (!text.trim()) return fail("Keine Daten – Datei wählen oder CSV einfügen");

  const { rows, errors } = parseCsv(text);
  if (rows.length === 0) {
    return {
      ok: false,
      error: "Keine gültige Zeile gefunden",
      problems: errors.slice(0, 5).map(({ line, reason }) => ({ line, reason })),
    };
  }

  const createMissing = formData.get("createCategories") === "true";
  const accountRef = await ownedRefs(user.id, {
    accountId: { collection: "accounts", raw: formData.get("accountId") },
  });
  if (!accountRef.ok) return fail(REF_ERROR.accountId);
  const accountId = accountRef.values.accountId;

  const existing = await categories.find({ userId: user.id }).toArray();
  const byName = new Map(
    existing.map((doc) => [`${doc.kind}:${doc.name.toLowerCase()}`, doc._id.toString()]),
  );

  const createdCategories: string[] = [];

  for (const row of rows) {
    if (!row.category) continue;

    const key = `${row.type}:${row.category.toLowerCase()}`;
    if (byName.has(key) || !createMissing) continue;

    const inserted = await categories.insertOne({
      userId: user.id,
      name: row.category.slice(0, 40),
      kind: row.type,
      color: row.type === "income" ? "#22c55e" : "#6366f1",
      icon: "",
      budgetCents: null,
      createdAt: new Date(),
    });

    byName.set(key, inserted.insertedId.toString());
    createdCategories.push(row.category);
  }

  const docs = rows.map((row) => ({
    userId: user.id,
    type: row.type,
    amountCents: row.amountCents,
    title: row.title,
    note: row.note,
    date: row.date,
    categoryId: row.category
      ? (byName.get(`${row.type}:${row.category.toLowerCase()}`) ?? null)
      : null,
    accountId,
    recurringId: null,
    createdAt: new Date(),
  }));

  await transactions.insertMany(docs);

  refresh();

  return {
    ok: true,
    message: `${docs.length} Buchungen importiert`,
    imported: docs.length,
    skipped: errors.length,
    createdCategories,
    problems: errors.slice(0, 5).map(({ line, reason }) => ({ line, reason })),
  };
}

/* ------------------------------ Erstattungen ------------------------------ */

/**
 * Geld, das dir jemand zurueckzahlt - Versicherung, Steuer, geliehen an
 * Freunde. Oft ist unklar, wann es kommt, deshalb ist das Datum optional.
 */
export async function saveRefund(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  await ensureIndexes();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return fail("Bezeichnung fehlt");

  const amountCents = amountFrom(formData.get("amount"));
  if (amountCents === null) return fail("Betrag ungültig");

  const fromRaw = String(formData.get("expectedFrom") ?? "").trim();
  const toRaw = String(formData.get("expectedTo") ?? "").trim();

  const expectedFrom =
    fromRaw && isoDate.safeParse(fromRaw).success ? fromRaw : null;
  const expectedTo = toRaw && isoDate.safeParse(toRaw).success ? toRaw : null;

  if (expectedFrom && expectedTo && expectedTo < expectedFrom) {
    return fail("Der Zeitraum endet vor dem Start");
  }

  const refs = await ownedRefs(user.id, {
    categoryId: { collection: "categories", raw: formData.get("categoryId") },
    accountId: { collection: "accounts", raw: formData.get("accountId") },
  });
  if (!refs.ok) return fail(REF_ERROR[refs.field]);

  const payload = {
    title: title.slice(0, 80),
    amountCents,
    expectedFrom,
    expectedTo,
    ...refs.values,
    note: String(formData.get("note") ?? "").trim().slice(0, 300) || null,
  };

  const id = String(formData.get("id") ?? "").trim();

  if (id) {
    const objectId = toObjectId(id);
    if (!objectId) return fail("Erstattung nicht gefunden");
    await refunds.updateOne({ _id: objectId, userId: user.id }, { $set: payload });
  } else {
    await refunds.insertOne({
      ...payload,
      userId: user.id,
      status: "open",
      receivedDate: null,
      createdAt: new Date(),
    });
  }

  refresh();
  return done(id ? "Erstattung aktualisiert" : "Erstattung angelegt");
}

/** Erstattung ist eingegangen: als Einnahme buchen und abhaken. */
export async function receiveRefund(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;

  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Erstattung nicht gefunden");

  const refund = await refunds.findOne({ _id: objectId, userId: user.id });
  if (!refund) return fail("Erstattung nicht gefunden");
  if (refund.status === "received") return fail("Schon als erhalten markiert");

  const dateRaw = String(formData.get("date") ?? "").trim();
  const date = dateRaw && isoDate.safeParse(dateRaw).success ? dateRaw : todayISO();

  // Betrag kann abweichen - manchmal kommt weniger zurueck als erwartet
  const actual = amountFrom(formData.get("amount")) ?? refund.amountCents;

  await transactions.insertOne({
    userId: user.id,
    type: "income",
    amountCents: actual,
    title: refund.title,
    note: refund.note ?? "Erstattung",
    date,
    dateEnd: null,
    datePrecision: "day",
    categoryId: refund.categoryId ?? null,
    accountId: refund.accountId ?? null,
    recurringId: null,
    createdAt: new Date(),
  });

  await refunds.updateOne(
    { _id: objectId, userId: user.id },
    { $set: { status: "received", receivedDate: date, amountCents: actual } },
  );

  refresh();
  return done("Als erhalten gebucht");
}

export async function deleteRefund(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  const objectId = toObjectId(String(formData.get("id") ?? ""));
  if (!objectId) return fail("Erstattung nicht gefunden");

  await refunds.deleteOne({ _id: objectId, userId: user.id });
  refresh();
  return done("Erstattung gelöscht");
}
