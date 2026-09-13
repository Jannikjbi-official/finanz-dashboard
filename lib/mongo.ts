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

export type TransactionDoc = {
  userId: string;
  type: Kind;
  amountCents: number;
  title: string;
  note: string | null;
  date: string; // YYYY-MM-DD
  categoryId: string | null;
  recurringId: string | null;
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

export const categories = db.collection<CategoryDoc>("categories");
export const transactions = db.collection<TransactionDoc>("transactions");
export const recurring = db.collection<RecurringDoc>("recurring");

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
