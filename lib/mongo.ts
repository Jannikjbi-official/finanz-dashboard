import { MongoClient, type Db, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB ?? "finanz";

const globalForMongo = globalThis as unknown as {
  __mongoClient?: MongoClient;
  __mongoIndexes?: Promise<void>;
};

export const client: MongoClient =
  globalForMongo.__mongoClient ?? new MongoClient(uri);

if (process.env.NODE_ENV !== "production") globalForMongo.__mongoClient = client;

export const db: Db = client.db(dbName);

export type Kind = "income" | "expense";
export type Interval = "weekly" | "monthly" | "quarterly" | "yearly";

export type CategoryDoc = {
  userId: string;
  name: string;
  kind: Kind;
  color: string;
  icon: string;
  budgetCents: number | null;
  createdAt: Date;
};

export type DatePrecision = "day" | "range" | "month";

export type TransactionDoc = {
  userId: string;
  type: Kind;
  amountCents: number;
  title: string;
  note: string | null;
  /** Bei Zeitraum und Monat der erste Tag des Fensters. */
  date: string; // YYYY-MM-DD
  /** Letzter Tag des Fensters, nur bei range und month gesetzt. */
  dateEnd?: string | null;
  datePrecision?: DatePrecision;
  categoryId: string | null;
  recurringId: string | null;
  /** Optional - aeltere Buchungen haben kein Konto. */
  accountId?: string | null;
  /**
   * Beide Haelften einer Umbuchung tragen dieselbe ID. Solche Buchungen
   * bewegen nur Geld zwischen eigenen Konten und zaehlen nie als Einnahme
   * oder Ausgabe.
   */
  transferGroupId?: string | null;
  /** Herkunft beim Import, fuer die Dublettenerkennung. */
  importHash?: string | null;
  createdAt: Date;
};

/**
 * Einmalige, noch nicht gebuchte Ereignisse: geplante Ausgaben und erwartete
 * Einnahmen (z. B. Erstattungen). Speist die Prognose.
 */
export type PlannedDoc = {
  userId: string;
  kind: Kind;
  title: string;
  amountCents: number;
  /** Fruehester und spaetester Termin; beide null = Zeitpunkt unbekannt. */
  dateFrom: string | null;
  dateTo: string | null;
  /** fixed = steht fest, expected = wird erwartet (zaehlt vorsichtig). */
  certainty: "fixed" | "expected";
  status: "open" | "done" | "cancelled";
  categoryId: string | null;
  accountId: string | null;
  note: string | null;
  /** Buchung, die beim Erledigen entstanden ist. */
  transactionId: string | null;
  /** Herkunft aus der alten Erstattungs-Collection (Migration). */
  legacyRefundId?: string | null;
  createdAt: Date;
};

export type UserSettingsDoc = {
  _id: string; // userId
  currency: "EUR";
  locale: "de-DE";
  timeZone: string;
  /** Mindestreserve; null = automatisch ein Monat Fixkosten. */
  reserveCents: number | null;
  /**
   * Geschaetzte variable Ausgaben pro Monat. Gilt nur, solange es noch
   * keinen vollen Monat mit Buchungen gibt.
   */
  variableEstimateCents?: number | null;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Gespeicherte Szenarien der Sandbox - nie echte Buchungen. */
export type ScenarioDoc = {
  userId: string;
  name: string;
  events: ScenarioEvent[];
  createdAt: Date;
  updatedAt: Date;
};

export type ScenarioEvent = {
  id: string;
  label: string;
  /** Vorzeichenbehaftet: negativ = Ausgabe. */
  amountCents: number;
  repeat: "once" | "monthly";
  date: string;
  /** Nur bei monthly: letzter Monat, null = unbegrenzt. */
  until: string | null;
};

export type RecurringDoc = {
  userId: string;
  type: Kind;
  amountCents: number;
  title: string;
  interval: Interval;
  categoryId: string | null;
  startDate: string;
  nextDue: string;
  active: boolean;
  note: string | null;
  createdAt: Date;
};

export type RefundDoc = {
  userId: string;
  title: string;
  amountCents: number;
  /** Wann das Geld erwartet wird - oft unbekannt. */
  expectedFrom: string | null;
  expectedTo: string | null;
  status: "open" | "received";
  receivedDate: string | null;
  categoryId: string | null;
  accountId: string | null;
  note: string | null;
  createdAt: Date;
};

export type GoalDoc = {
  userId: string;
  title: string;
  targetCents: number;
  savedCents: number;
  deadline: string | null;
  color: string;
  note: string | null;
  /** Geplante monatliche Sparrate; fliesst als Abfluss in die Prognose. */
  monthlyContributionCents?: number | null;
  /** Konto, auf dem das Geld liegt (nur zur Anzeige). */
  accountId?: string | null;
  createdAt: Date;
};

export type AccountDoc = {
  userId: string;
  name: string;
  kind: "giro" | "cash" | "savings" | "other";
  startBalanceCents: number;
  color: string;
  icon: string;
  archived: boolean;
  /**
   * Zaehlt zum verfuegbaren Geld (Prognose, Sicherheitszone). Fehlt das
   * Feld, gilt: alles ausser Sparkonten.
   */
  liquid?: boolean;
  createdAt: Date;
};

export const categories = db.collection<CategoryDoc>("categories");
export const transactions = db.collection<TransactionDoc>("transactions");
export const recurring = db.collection<RecurringDoc>("recurring");
export const goals = db.collection<GoalDoc>("goals");
export const refunds = db.collection<RefundDoc>("refunds");
export const accounts = db.collection<AccountDoc>("accounts");
export const planned = db.collection<PlannedDoc>("planned");
export const settings = db.collection<UserSettingsDoc>("user_settings");
export const scenarios = db.collection<ScenarioDoc>("scenarios");

/** Alle Collections mit Finanzdaten eines Nutzers (Export, Loeschung). */
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

/** Indizes einmal pro Prozess anlegen. */
export function ensureIndexes(): Promise<void> {
  globalForMongo.__mongoIndexes ??= (async () => {
    await categories.createIndex(
      { userId: 1, kind: 1, name: 1 },
      { unique: true },
    );
    await transactions.createIndex({ userId: 1, date: -1 });
    await transactions.createIndex({ userId: 1, categoryId: 1 });
    await recurring.createIndex({ userId: 1, active: 1 });
    await goals.createIndex({ userId: 1 });
    await refunds.createIndex({ userId: 1, status: 1 });
    await accounts.createIndex({ userId: 1, archived: 1 });
    await transactions.createIndex({ userId: 1, accountId: 1 });
    await transactions.createIndex(
      { userId: 1, importHash: 1 },
      { partialFilterExpression: { importHash: { $type: "string" } } },
    );
    await planned.createIndex({ userId: 1, status: 1, dateFrom: 1 });
    await planned.createIndex(
      { userId: 1, legacyRefundId: 1 },
      { unique: true, partialFilterExpression: { legacyRefundId: { $type: "string" } } },
    );
    await scenarios.createIndex({ userId: 1, updatedAt: -1 });
  })().catch((error) => {
    globalForMongo.__mongoIndexes = undefined;
    throw error;
  });

  return globalForMongo.__mongoIndexes;
}

export function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export { ObjectId };
