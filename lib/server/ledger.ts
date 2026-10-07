import "server-only";
import type { Filter } from "mongodb";
import { transactions, type TransactionDoc } from "../mongo";
import { monthEnd, monthStart } from "../domain/calendar";
import type { TransactionRow } from "@/features/shared/types";

export type LedgerFilter = {
  /** "2026-10" oder null fuer alle Monate. */
  month: string | null;
  query: string;
  type: "income" | "expense" | "transfer" | null;
  /** Kategorie-ID, "none" fuer ohne Kategorie, null fuer alle. */
  categoryId: string | null;
  /** Konto-ID, "none" fuer ohne Konto, null fuer alle. */
  accountId: string | null;
};

export const LEDGER_LIMIT = 500;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Buchungen eines Nutzers nach Filter. Der userId-Filter steht immer vorne. */
export async function listTransactions(userId: string, filter: LedgerFilter) {
  const query: Filter<TransactionDoc> = { userId };
  const and: Filter<TransactionDoc>[] = [];

  if (filter.month) query.date = { $gte: monthStart(filter.month), $lte: monthEnd(filter.month) };

  if (filter.type === "transfer") query.transferGroupId = { $type: "string" };
  else if (filter.type) {
    query.type = filter.type;
    and.push({ $or: [{ transferGroupId: null }, { transferGroupId: { $exists: false } }] });
  }

  if (filter.categoryId === "none") and.push({ $or: [{ categoryId: null }, { categoryId: { $exists: false } }] });
  else if (filter.categoryId) query.categoryId = filter.categoryId;

  if (filter.accountId === "none") and.push({ $or: [{ accountId: null }, { accountId: { $exists: false } }] });
  else if (filter.accountId) query.accountId = filter.accountId;

  const text = filter.query.trim().slice(0, 80);
  if (text) {
    const pattern = new RegExp(escapeRegex(text), "i");
    and.push({ $or: [{ title: pattern }, { note: pattern }] });
  }

  if (and.length > 0) query.$and = and;

  const docs = await transactions
    .find(query)
    .sort({ date: -1, createdAt: -1 })
    .limit(LEDGER_LIMIT + 1)
    .toArray();

  const rows: TransactionRow[] = docs.slice(0, LEDGER_LIMIT).map((doc) => ({
    id: doc._id.toString(),
    type: doc.type,
    amountCents: doc.amountCents,
    title: doc.title,
    note: doc.note ?? null,
    date: doc.date,
    dateEnd: doc.dateEnd ?? null,
    datePrecision: doc.datePrecision ?? "day",
    categoryId: doc.categoryId ?? null,
    accountId: doc.accountId ?? null,
    recurringId: doc.recurringId ?? null,
    transferGroupId: doc.transferGroupId ?? null,
  }));

  return { rows, truncated: docs.length > LEDGER_LIMIT };
}
