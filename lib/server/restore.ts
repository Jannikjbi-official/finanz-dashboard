import "server-only";
import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import { isISODate } from "../domain/calendar";
import type { SnapshotInfo } from "../domain/types";
import { db, settings, USER_DATA_COLLECTIONS } from "./db";

/**
 * Eine JSON-Sicherung (Export unter Einstellungen -> Daten) zurueckspielen.
 * Ersetzt alle eigenen Daten; vorher wird der aktuelle Stand als Snapshot
 * gespeichert und laesst sich damit wieder herstellen.
 */

type Collection = (typeof USER_DATA_COLLECTIONS)[number];
export type BackupData = { collections: Partial<Record<Collection, Document[]>>; settings: Document | null };

/** Grenzen fuer hochgeladene Sicherungen (die Server Action nimmt hoechstens 4 MB). */
export const MAX_RESTORE_DOCS = 50_000;
const MAX_SNAPSHOTS = 3;

const snapshots = db.collection<{ userId: string; createdAt: Date; reason: string; data: BackupData; counts: Record<string, number> }>("user_snapshots");

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const OBJECT_ID = /^[0-9a-f]{24}$/i;
const isoDate = z.string().refine(isISODate);
const id = z.string().min(1).max(64);

/** Kernfelder, ohne die die App einen Datensatz nicht lesen kann. Weitere Felder bleiben erhalten. */
const SCHEMAS: Partial<Record<Collection, z.ZodType>> = {
  accounts: z.looseObject({ id, name: z.string().min(1), kind: z.enum(["giro", "savings", "cash", "paypal", "other"]) }),
  categories: z.looseObject({ id, name: z.string().min(1), kind: z.enum(["income", "expense"]) }),
  transactions: z.looseObject({ id, type: z.enum(["income", "expense"]), amountCents: z.number().int().nonnegative(), date: isoDate, title: z.string() }),
  recurring: z.looseObject({
    id,
    type: z.enum(["income", "expense"]),
    title: z.string(),
    amountCents: z.number().int().nonnegative(),
    interval: z.string(),
    nextDue: isoDate,
    startDate: isoDate,
  }),
  wishes: z.looseObject({ id, title: z.string(), amountCents: z.number().int().nonnegative() }),
  rules: z.looseObject({ id, match: z.string().min(1), categoryId: z.string() }),
};
const anyDoc = z.looseObject({ id });

/** JSON zurueck in Datenbank-Typen: _id als ObjectId, Zeitstempel als Date, immer der eigene Nutzer. */
function revive(value: unknown, userId: string, key?: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => revive(entry, userId));
  if (value && typeof value === "object") {
    const result: Document = {};
    for (const [field, entry] of Object.entries(value)) result[field] = revive(entry, userId, field);
    // Verschachtelte Datensaetze (Papierkorb) gehoeren ebenfalls dem eigenen Konto
    if ("userId" in result) result.userId = userId;
    return result;
  }
  if (typeof value === "string") {
    if (key === "_id" && OBJECT_ID.test(value)) return new ObjectId(value);
    if (ISO_DATETIME.test(value)) return new Date(value);
  }
  return value;
}

function toKey(value: string) {
  return OBJECT_ID.test(value) ? new ObjectId(value) : value;
}

export type ParsedBackup = { ok: true; data: BackupData; counts: Record<string, number>; exportedAt: string | null } | { ok: false; error: string };

/** Prueft eine hochgeladene Sicherung und bereitet sie zum Einspielen vor. */
export function parseBackup(text: string, userId: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Die Datei ist kein gültiges JSON." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Das ist keine Sicherung aus dieser App." };
  const input = raw as Record<string, unknown>;
  if (!Array.isArray(input.accounts) || !Array.isArray(input.transactions)) {
    return { ok: false, error: "Das ist keine Sicherung aus dieser App (Konten und Buchungen fehlen)." };
  }

  const collections: BackupData["collections"] = {};
  const counts: Record<string, number> = {};
  let total = 0;
  for (const name of USER_DATA_COLLECTIONS) {
    const list = input[name];
    if (list === undefined) continue;
    if (!Array.isArray(list)) return { ok: false, error: `„${name}“ ist keine Liste.` };
    total += list.length;
    if (total > MAX_RESTORE_DOCS) return { ok: false, error: `Zu viele Einträge (mehr als ${MAX_RESTORE_DOCS.toLocaleString("de-DE")}).` };
    const schema = SCHEMAS[name] ?? anyDoc;
    const docs: Document[] = [];
    const seen = new Set<string>();
    for (const [index, entry] of list.entries()) {
      const parsed = schema.safeParse(entry);
      if (!parsed.success) return { ok: false, error: `Eintrag ${index + 1} in „${name}“ ist unvollständig oder beschädigt.` };
      const { id: docId, userId: _ignored, ...rest } = parsed.data as { id: string; userId?: unknown } & Document;
      if (seen.has(docId)) return { ok: false, error: `Doppelte ID in „${name}“.` };
      seen.add(docId);
      docs.push({ ...(revive(rest, userId) as Document), _id: toKey(docId), userId });
    }
    collections[name] = docs;
    counts[name] = docs.length;
  }

  const ownSettings = Array.isArray(input.settings) && input.settings[0] && typeof input.settings[0] === "object" ? (input.settings[0] as Document) : null;
  let restoredSettings: Document | null = null;
  if (ownSettings) {
    const { _id: _ignored, ...rest } = revive(ownSettings, userId) as Document;
    restoredSettings = rest;
  }
  const exportedAt = typeof input.exportedAt === "string" && ISO_DATETIME.test(input.exportedAt) ? input.exportedAt : null;
  return { ok: true, data: { collections, settings: restoredSettings }, counts, exportedAt };
}

/** Der aktuelle Stand eines Nutzers, so wie er in der Datenbank liegt. */
async function currentData(userId: string): Promise<BackupData> {
  const collections: BackupData["collections"] = {};
  for (const name of USER_DATA_COLLECTIONS) collections[name] = await db.collection(name).find({ userId }).toArray();
  const own = await settings.findOne({ _id: userId });
  let current: Document | null = null;
  if (own) {
    const { _id: _ignored, ...rest } = own;
    current = rest;
  }
  return { collections, settings: current };
}

function countsOf(data: BackupData) {
  return Object.fromEntries(Object.entries(data.collections).map(([name, docs]) => [name, docs?.length ?? 0]));
}

/** Fremde Datensaetze mit gleicher ID? Dann passt die Sicherung nicht zu diesem Zugang. */
async function collides(userId: string, data: BackupData) {
  for (const [name, docs] of Object.entries(data.collections)) {
    if (!docs?.length) continue;
    const ids = docs.map((doc) => doc._id);
    if ((await db.collection(name).countDocuments({ _id: { $in: ids }, userId: { $ne: userId } }, { limit: 1 })) > 0) return true;
  }
  return false;
}

async function replaceAll(userId: string, data: BackupData) {
  for (const name of USER_DATA_COLLECTIONS) {
    const docs = data.collections[name];
    if (docs === undefined) continue;
    await db.collection(name).deleteMany({ userId });
    if (docs.length > 0) await db.collection(name).insertMany(docs);
  }
  if (data.settings) {
    await settings.updateOne({ _id: userId }, { $set: { ...data.settings, updatedAt: new Date() } }, { upsert: true });
  }
}

export type RestoreOutcome = { ok: true; snapshotId: string; counts: Record<string, number> } | { ok: false; error: string };

/**
 * Sicherung einspielen: aktuellen Stand als Snapshot sichern, dann je
 * Collection ersetzen. Scheitert unterwegs etwas, wird der Snapshot
 * zurueckgespielt.
 */
export async function restoreBackup(userId: string, data: BackupData, reason = "Vor Wiederherstellung"): Promise<RestoreOutcome> {
  if (await collides(userId, data)) return { ok: false, error: "Diese Sicherung gehört zu einem anderen Zugang und kann hier nicht eingespielt werden." };

  const before = await currentData(userId);
  let snapshotId: string;
  try {
    const { insertedId } = await snapshots.insertOne({ userId, createdAt: new Date(), reason, data: before, counts: countsOf(before) });
    snapshotId = insertedId.toString();
  } catch {
    return { ok: false, error: "Der aktuelle Stand ist zu groß für eine automatische Sicherung. Bitte zuerst die JSON-Sicherung herunterladen." };
  }

  try {
    await replaceAll(userId, data);
  } catch (error) {
    await replaceAll(userId, before);
    throw error;
  }

  // Nur die letzten Snapshots behalten
  const old = await snapshots.find({ userId }, { projection: { _id: 1 } }).sort({ createdAt: -1 }).skip(MAX_SNAPSHOTS).toArray();
  if (old.length > 0) await snapshots.deleteMany({ _id: { $in: old.map((doc) => doc._id) } });
  return { ok: true, snapshotId, counts: countsOf(data) };
}


export async function listSnapshots(userId: string): Promise<SnapshotInfo[]> {
  const docs = await snapshots.find({ userId }, { projection: { data: 0 } }).sort({ createdAt: -1 }).toArray();
  return docs.map((doc) => ({ id: doc._id.toString(), createdAt: doc.createdAt.toISOString(), reason: doc.reason, counts: doc.counts }));
}

/** Stand vor einer Wiederherstellung zurueckholen (der jetzige Stand wird dabei selbst gesichert). */
export async function restoreSnapshot(userId: string, snapshotId: string): Promise<RestoreOutcome> {
  if (!OBJECT_ID.test(snapshotId)) return { ok: false, error: "Sicherung nicht gefunden" };
  const snapshot = await snapshots.findOne({ _id: new ObjectId(snapshotId), userId });
  if (!snapshot) return { ok: false, error: "Sicherung nicht gefunden" };
  const result = await restoreBackup(userId, snapshot.data, "Vor Zurückholen eines Stands");
  if (result.ok) await snapshots.deleteOne({ _id: snapshot._id });
  return result;
}
