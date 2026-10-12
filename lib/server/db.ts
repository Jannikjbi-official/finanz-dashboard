import { MongoClient, ObjectId, type Db } from "mongodb";
import type { AccountKind, CostType, Interval, NoticePeriod, RecurringStatus, TxStatus, TxType } from "../domain/types";

/**
 * MongoDB-Anbindung und Dokumenttypen.
 *
 * Die Typen sind bewusst abwaertskompatibel zu den bestehenden Daten: neue
 * Felder sind optional, fehlende Werte werden beim Lesen (lib/server/data.ts)
 * mit nachvollziehbaren Standardwerten belegt. Bestehende Dokumente muessen
 * dafuer nicht umgeschrieben werden.
 */

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB ?? "finanz";

const globalForMongo = globalThis as unknown as {
  __mongoClient?: MongoClient;
  __mongoIndexes?: Promise<void>;
};

export const client: MongoClient = globalForMongo.__mongoClient ?? new MongoClient(uri);
if (process.env.NODE_ENV !== "production") globalForMongo.__mongoClient = client;

export const db: Db = client.db(dbName);

export type AccountDoc = {
  userId: string;
  name: string;
  kind: AccountKind;
  startBalanceCents: number;
  archived: boolean;
  /** Fehlt das Feld, gilt: alles ausser Sparkonten ist verfuegbar. */
  liquid?: boolean;
  /** Altdaten, wird nicht mehr verwendet. */
  color?: string;
  icon?: string;
  createdAt: Date;
  updatedAt?: Date;
};

export type CategoryDoc = {
  userId: string;
  name: string;
  kind: TxType;
  color: string;
  /** Altdaten. */
  icon?: string;
  budgetCents?: number | null;
  createdAt: Date;
};

export type TransactionDoc = {
  userId: string;
  type: TxType;
  /** Fehlt bei Altdaten - die waren immer tatsaechlich gebucht. */
  status?: TxStatus;
  amountCents: number;
  title: string;
  note: string | null;
  date: string;
  /** Altdaten mit unscharfem Datum. */
  dateEnd?: string | null;
  datePrecision?: "day" | "range" | "month";
  categoryId: string | null;
  accountId?: string | null;
  transferGroupId?: string | null;
  recurringId: string | null;
  recurringDue?: string | null;
  importHash?: string | null;
  /** Herkunft aus der frueheren Collection "planned" (Migration 005). */
  legacyPlannedId?: string | null;
  createdAt: Date;
  updatedAt?: Date;
};

export type RecurringDoc = {
  userId: string;
  type: TxType;
  amountCents: number;
  title: string;
  interval: Interval;
  categoryId: string | null;
  startDate: string;
  nextDue: string;
  /** Altdaten: ersetzt durch `status`. */
  active: boolean;
  status?: RecurringStatus;
  costType?: CostType;
  provider?: string | null;
  accountId?: string | null;
  endDate?: string | null;
  cancelledOn?: string | null;
  noticePeriod?: NoticePeriod | null;
  note: string | null;
  createdAt: Date;
  updatedAt?: Date;
};

export type SettingsDoc = {
  _id: string; // userId
  currency: "EUR";
  locale: "de-DE";
  timeZone: string;
  createdAt: Date;
  updatedAt: Date;
  /** Weitere Altfelder bleiben unangetastet. */
  [legacy: string]: unknown;
};

/** Frueheres Modell fuer geplante/erwartete Einzelposten (nur noch Migration). */
export type LegacyPlannedDoc = {
  userId: string;
  kind: TxType;
  title: string;
  amountCents: number;
  dateFrom: string | null;
  dateTo: string | null;
  status: "open" | "done" | "cancelled";
  categoryId: string | null;
  accountId: string | null;
  note: string | null;
  createdAt: Date;
};

export const accounts = db.collection<AccountDoc>("accounts");
export const categories = db.collection<CategoryDoc>("categories");
export const transactions = db.collection<TransactionDoc>("transactions");
export const recurring = db.collection<RecurringDoc>("recurring");
export const settings = db.collection<SettingsDoc>("user_settings");
export const planned = db.collection<LegacyPlannedDoc>("planned");

/**
 * Alle Collections mit Finanzdaten eines Nutzers - auch die nicht mehr
 * genutzten, damit der Vollexport nichts verliert.
 */
export const USER_DATA_COLLECTIONS = [
  "accounts",
  "categories",
  "transactions",
  "recurring",
  "planned",
  "goals",
  "refunds",
  "scenarios",
] as const;

/** Indizes einmal pro Prozess anlegen. createIndex ist idempotent. */
export function ensureIndexes(): Promise<void> {
  globalForMongo.__mongoIndexes ??= (async () => {
    await Promise.all([
      categories.createIndex({ userId: 1, kind: 1, name: 1 }, { unique: true }),
      transactions.createIndex({ userId: 1, date: -1 }),
      transactions.createIndex({ userId: 1, accountId: 1 }),
      transactions.createIndex({ userId: 1, transferGroupId: 1 }, { partialFilterExpression: { transferGroupId: { $type: "string" } } }),
      transactions.createIndex({ userId: 1, importHash: 1 }, { partialFilterExpression: { importHash: { $type: "string" } } }),
      transactions.createIndex(
        { userId: 1, legacyPlannedId: 1 },
        { unique: true, partialFilterExpression: { legacyPlannedId: { $type: "string" } } },
      ),
      recurring.createIndex({ userId: 1, status: 1 }),
      accounts.createIndex({ userId: 1, archived: 1 }),
    ]);
  })().catch((error) => {
    globalForMongo.__mongoIndexes = undefined;
    throw error;
  });
  return globalForMongo.__mongoIndexes;
}

export function toObjectId(id: unknown): ObjectId | null {
  return typeof id === "string" && ObjectId.isValid(id) && /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export { ObjectId };
