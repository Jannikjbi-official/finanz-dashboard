"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ensureIndexes, planned, scenarios, settings, toObjectId, transactions, type ScenarioEvent } from "../../mongo";
import { requireUser } from "../../session";
import { parseAmountToCents } from "../../money";
import { isISODate, todayIn } from "../../domain/calendar";
import { limitUser } from "../rate-limit";
import { ownedRefs } from "../ownership";
import { ensureSettings, getSettings } from "../user-data";
import type { ActionState } from "../../actions";

function fail(error: string): ActionState {
  return { ok: false, error };
}

function done(message: string): ActionState {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

async function authorize() {
  const user = await requireUser();
  const limit = await limitUser(user.id, "write");
  return {
    user,
    blocked: limit.allowed ? null : fail(`Zu viele Anfragen – bitte in ${limit.retryAfterSeconds} Sekunden erneut versuchen.`),
  };
}

function dateOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw && isISODate(raw) ? raw : null;
}

/* ----------------------------- Geplant & erwartet ----------------------------- */

export async function savePlanned(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  await ensureIndexes();

  const kind = z.enum(["income", "expense"]).safeParse(formData.get("kind"));
  if (!kind.success) return fail("Art fehlt");

  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  if (!title) return fail("Bezeichnung fehlt");

  const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (!amountCents) return fail("Betrag ungültig");

  const timing = String(formData.get("timing") ?? "day");
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

  if (timing === "day") {
    dateFrom = dateOrNull(formData.get("date"));
    if (!dateFrom) return fail("Datum fehlt");
    dateTo = dateFrom;
  } else if (timing === "range") {
    dateFrom = dateOrNull(formData.get("dateFrom"));
    dateTo = dateOrNull(formData.get("dateTo"));
    if (!dateFrom && !dateTo) return fail("Mindestens ein Datum angeben – oder „Termin offen“ wählen");
    if (dateFrom && dateTo && dateTo < dateFrom) return fail("Der Zeitraum endet vor dem Start");
  }

  const refs = await ownedRefs(user.id, {
    categoryId: { collection: "categories", raw: formData.get("categoryId") },
    accountId: { collection: "accounts", raw: formData.get("accountId") },
  });
  if (!refs.ok) return fail(refs.field === "categoryId" ? "Kategorie nicht gefunden" : "Konto nicht gefunden");

  const payload = {
    kind: kind.data,
    title,
    amountCents,
    dateFrom,
    dateTo,
    certainty: formData.get("certainty") === "expected" ? ("expected" as const) : ("fixed" as const),
    note: String(formData.get("note") ?? "").trim().slice(0, 300) || null,
    ...refs.values,
  };

  const id = toObjectId(String(formData.get("id") ?? ""));
  if (id) {
    const result = await planned.updateOne({ _id: id, userId: user.id, status: "open" }, { $set: payload });
    if (result.matchedCount === 0) return fail("Eintrag nicht gefunden");
    return done("Gespeichert");
  }

  await planned.insertOne({
    ...payload,
    userId: user.id,
    status: "open",
    transactionId: null,
    createdAt: new Date(),
  });
  return done(kind.data === "income" ? "Erwartete Einnahme eingetragen" : "Geplante Ausgabe eingetragen");
}

/** Ist eingetreten: als echte Buchung erfassen und abhaken. Betrag darf abweichen. */
export async function completePlanned(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;

  const id = toObjectId(String(formData.get("id") ?? ""));
  if (!id) return fail("Eintrag nicht gefunden");

  const item = await planned.findOne({ _id: id, userId: user.id });
  if (!item) return fail("Eintrag nicht gefunden");
  if (item.status !== "open") return fail("Schon erledigt");

  const userSettings = await getSettings(user.id);
  const date = dateOrNull(formData.get("date")) ?? todayIn(userSettings.timeZone);
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountCents = amountRaw ? parseAmountToCents(amountRaw) : item.amountCents;
  if (!amountCents) return fail("Betrag ungültig");

  const refs = await ownedRefs(user.id, {
    accountId: { collection: "accounts", raw: formData.get("accountId") ?? item.accountId },
  });
  if (!refs.ok) return fail("Konto nicht gefunden");

  const inserted = await transactions.insertOne({
    userId: user.id,
    type: item.kind,
    amountCents,
    title: item.title,
    note: item.note,
    date,
    dateEnd: null,
    datePrecision: "day",
    categoryId: item.categoryId,
    accountId: refs.values.accountId,
    recurringId: null,
    createdAt: new Date(),
  });

  await planned.updateOne(
    { _id: id, userId: user.id },
    { $set: { status: "done", transactionId: inserted.insertedId.toString(), amountCents } },
  );
  return done("Als Buchung erfasst");
}

export async function deletePlanned(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  const id = toObjectId(String(formData.get("id") ?? ""));
  if (!id) return fail("Eintrag nicht gefunden");
  await planned.deleteOne({ _id: id, userId: user.id });
  return done("Entfernt");
}

/* -------------------------------- Einstellungen ------------------------------- */

const TIME_ZONES = new Set(Intl.supportedValuesOf("timeZone"));

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  await ensureSettings(user.id);

  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (formData.has("reserveMode")) {
    if (formData.get("reserveMode") === "auto") update.reserveCents = null;
    else {
      const cents = parseAmountToCents(String(formData.get("reserve") ?? ""));
      if (cents === null) return fail("Mindestreserve ungültig");
      update.reserveCents = cents;
    }
  }

  if (formData.has("variableEstimate")) {
    const raw = String(formData.get("variableEstimate") ?? "").trim();
    const cents = raw ? parseAmountToCents(raw) : null;
    if (raw && cents === null) return fail("Betrag für Alltagsausgaben ungültig");
    update.variableEstimateCents = cents;
  }

  if (formData.has("timeZone")) {
    const zone = String(formData.get("timeZone"));
    if (!TIME_ZONES.has(zone)) return fail("Zeitzone unbekannt");
    update.timeZone = zone;
  }

  await settings.updateOne({ _id: user.id }, { $set: update });
  return done("Einstellungen gespeichert");
}

export async function completeOnboarding(): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  await ensureSettings(user.id);
  await settings.updateOne({ _id: user.id }, { $set: { onboardingCompletedAt: new Date(), updatedAt: new Date() } });
  return done("Eingerichtet");
}

/* ---------------------------------- Sandbox ---------------------------------- */

const eventSchema = z.object({
  id: z.string().max(40),
  label: z.string().trim().min(1).max(60),
  amountCents: z.number().int().refine((value) => Math.abs(value) <= 100_000_000_00 && value !== 0),
  repeat: z.enum(["once", "monthly"]),
  date: z.string().refine(isISODate),
  until: z.string().refine(isISODate).nullable(),
});

const scenarioSchema = z.object({
  id: z.string().nullable(),
  name: z.string().trim().min(1, "Name fehlt").max(60),
  events: z.array(eventSchema).max(40),
});

export async function saveScenario(input: {
  id: string | null;
  name: string;
  events: ScenarioEvent[];
}): Promise<ActionState & { id?: string }> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  await ensureIndexes();

  const parsed = scenarioSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Szenario ungültig");

  const events = parsed.data.events.map((event) => ({ ...event, id: event.id || randomUUID() }));
  const now = new Date();

  if (parsed.data.id) {
    const id = toObjectId(parsed.data.id);
    if (!id) return fail("Szenario nicht gefunden");
    const result = await scenarios.updateOne(
      { _id: id, userId: user.id },
      { $set: { name: parsed.data.name, events, updatedAt: now } },
    );
    if (result.matchedCount === 0) return fail("Szenario nicht gefunden");
    revalidatePath("/app/entscheiden/sandbox");
    return { ok: true, message: "Szenario gespeichert", id: parsed.data.id };
  }

  if ((await scenarios.countDocuments({ userId: user.id })) >= 20) {
    return fail("Höchstens 20 Szenarien – lösche ein altes.");
  }

  const inserted = await scenarios.insertOne({
    userId: user.id,
    name: parsed.data.name,
    events,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath("/app/entscheiden/sandbox");
  return { ok: true, message: "Szenario gespeichert", id: inserted.insertedId.toString() };
}

export async function deleteScenario(id: string): Promise<ActionState> {
  const { user, blocked } = await authorize();
  if (blocked) return blocked;
  const objectId = toObjectId(id);
  if (!objectId) return fail("Szenario nicht gefunden");
  await scenarios.deleteOne({ _id: objectId, userId: user.id });
  revalidatePath("/app/entscheiden/sandbox");
  return { ok: true, message: "Szenario gelöscht" };
}
