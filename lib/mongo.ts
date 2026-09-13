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
  createdAt: Date;
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
  createdAt: Date;
};

export const categories = db.collection<CategoryDoc>("categories");
export const transactions = db.collection<TransactionDoc>("transactions");
export const recurring = db.collection<RecurringDoc>("recurring");
export const goals = db.collection<GoalDoc>("goals");
export const refunds = db.collection<RefundDoc>("refunds");
export const accounts = db.collection<AccountDoc>("accounts");

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
