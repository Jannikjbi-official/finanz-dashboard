import { MongoClient, ObjectId, type Db } from "mongodb";
import type {
  AccountKind,
  CostType,
  Interval,
  NoticePeriod,
  RecurringStatus,
  TxStatus,
  TxType,
  WishPriority,
  WishStatus,
} from "../domain/types";

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
  /** Kontostand mit Datum, siehe Account.balanceAnchor. */
  balanceAnchor?: { date: string; amountCents: number } | null;
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
  /** Von der Bank vorgemerkt, siehe Transaction.bankPending. */
  bankPending?: boolean;
  /** Abgelehnte Zuordnungsvorschlaege (recurring-IDs). */
  dismissedRecurring?: string[];
  /** CSV-Import, aus dem die Buchung stammt (Collection "imports"). */
  importId?: string | null;
  /** Aus einem Wunsch eingeplant (Collection "wishes"). */
  wishId?: string | null;
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
  /** Am Faelligkeitstag automatisch buchen (opt-in). */
  autoBook?: boolean;
  /** Bewusst nicht uebernommener abweichender Betrag. */
  amountCheckedCents?: number | null;
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
  /** Discord-Benachrichtigungen (siehe lib/server/notify.ts). */
  discordWebhookUrl?: string;
  notifyDue?: boolean;
  notifyMonthly?: boolean;
  /** Abgelehnte Vorschlaege "regelmaessige Zahlung erkannt". */
  dismissedRecurringSuggestions?: string[];
  /** Mit "Passt" ausgeblendete Auffaelligkeiten (siehe lib/domain/anomalies.ts). */
  dismissedAnomalies?: string[];
  /** Weitere Altfelder bleiben unangetastet. */
  [legacy: string]: unknown;
};

export type WishDoc = {
  userId: string;
  title: string;
  amountCents: number;
  /** Wunschtermin bzw. "fruehestens"; null = Zeitpunkt offen. */
  targetDate: string | null;
  status: WishStatus;
  priority: WishPriority;
  /** Sparziel oder Gruppe, z. B. "Mikrofon-Setup". */
  group: string | null;
  link: string | null;
  note: string | null;
  categoryId: string | null;
  /** Geplante Zahlung, die beim Einplanen entstanden ist. */
  transactionId: string | null;
  importId?: string | null;
  importHash?: string | null;
  createdAt: Date;
  updatedAt?: Date;
};

/** Regel fuer die automatische Kategorisierung (lib/domain/rules.ts). */
export type RuleDoc = {
  userId: string;
  match: string;
  categoryId: string;
  kind: TxType | null;
  accountId: string | null;
  order: number;
  createdAt: Date;
};

/** Vorlage fuer haeufige Buchungen (siehe Template in lib/domain/types.ts). */
export type TemplateDoc = {
  userId: string;
  type: TxType;
  title: string;
  amountCents: number | null;
  categoryId: string | null;
  accountId: string | null;
  note: string | null;
  createdAt: Date;
};

/** Ein CSV-Import. Alle Datensaetze daraus tragen die importId. */
export type ImportDoc = {
  _id: string;
  userId: string;
  kind: "transactions" | "wishes";
  fileName: string | null;
  accountId: string | null;
  rowCount: number;
  dateFrom: string | null;
  dateTo: string | null;
  createdAt: Date;
  undoneAt: Date | null;
  undoneCount?: number;
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
export const wishes = db.collection<WishDoc>("wishes");
export const imports = db.collection<ImportDoc>("imports");
export const rules = db.collection<RuleDoc>("rules");
export const templates = db.collection<TemplateDoc>("templates");
/**
 * Papierkorb: Kopie aller geloeschten Buchungen - aus "Loeschen" und aus
 * "Import rueckgaengig". Ein Eintrag je Vorgang, wiederherstellbar. Die
 * Collection heisst aus historischen Gruenden import_trash.
 */
export type TrashDoc = {
  userId: string;
  /** Gesetzt, wenn der Eintrag aus "Import rueckgaengig" stammt. */
  importId?: string | null;
  kind: "transactions" | "wishes";
  docs: unknown[];
  /** Kurzbeschreibung fuer die Liste, z. B. "Lidl, 12,50 €" oder "3 Buchungen". */
  label?: string;
  deletedAt: Date;
  /** Danach loescht MongoDB den Eintrag (TTL). Ohne Datum: bleibt bis "Endgueltig loeschen". */
  expiresAt?: Date | null;
};
export const importTrash = db.collection<TrashDoc>("import_trash");

/**
 * Alle Collections mit Finanzdaten eines Nutzers - auch die nicht mehr
 * genutzten, damit der Vollexport nichts verliert.
 */
export const USER_DATA_COLLECTIONS = [
  "accounts",
  "categories",
  "transactions",
  "recurring",
  "wishes",
  "imports",
  "import_trash",
  "rules",
  "templates",
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
      transactions.createIndex({ userId: 1, importId: 1 }, { partialFilterExpression: { importId: { $type: "string" } } }),
      wishes.createIndex({ userId: 1, status: 1 }),
      imports.createIndex({ userId: 1, createdAt: -1 }),
      rules.createIndex({ userId: 1, order: 1 }),
      templates.createIndex({ userId: 1, title: 1 }),
      transactions.createIndex(
        { userId: 1, legacyPlannedId: 1 },
        { unique: true, partialFilterExpression: { legacyPlannedId: { $type: "string" } } },
      ),
      recurring.createIndex({ userId: 1, status: 1 }),
      accounts.createIndex({ userId: 1, archived: 1 }),
      importTrash.createIndex({ userId: 1, deletedAt: -1 }),
      importTrash.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
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
