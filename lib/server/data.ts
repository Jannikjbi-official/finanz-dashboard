import "server-only";
import { cache } from "react";
import type { WithId } from "mongodb";
import { todayIn } from "../domain/calendar";
import { inferCostType } from "../domain/labels";
import type { Account, Category, Recurring, Transaction } from "../domain/types";
import {
  accounts,
  categories,
  ensureIndexes,
  recurring,
  transactions,
  type AccountDoc,
  type CategoryDoc,
  type RecurringDoc,
  type TransactionDoc,
} from "./db";
import { getSettings } from "./user-data";

/**
 * Lesezugriff. Jede Abfrage ist an die userId gebunden; Dokumente werden in
 * die Fachtypen aus lib/domain uebersetzt. Fehlende Felder aus Altdaten
 * bekommen hier ihre Standardwerte.
 */

export function toAccount(doc: WithId<AccountDoc>): Account {
  return {
    id: doc._id.toString(),
    name: doc.name,
    kind: doc.kind,
    startBalanceCents: doc.startBalanceCents ?? 0,
    liquid: doc.liquid ?? doc.kind !== "savings",
    archived: Boolean(doc.archived),
  };
}

export function toCategory(doc: WithId<CategoryDoc>): Category {
  return { id: doc._id.toString(), name: doc.name, kind: doc.kind, color: doc.color };
}

export function toTransaction(doc: WithId<TransactionDoc>): Transaction {
  return {
    id: doc._id.toString(),
    type: doc.type,
    status: doc.status ?? "booked",
    amountCents: doc.amountCents,
    date: doc.date,
    title: doc.title,
    note: doc.note ?? null,
    categoryId: doc.categoryId ?? null,
    accountId: doc.accountId ?? null,
    transferGroupId: doc.transferGroupId ?? null,
    recurringId: doc.recurringId ?? null,
    recurringDue: doc.recurringDue ?? null,
  };
}

export function toRecurring(doc: WithId<RecurringDoc>): Recurring {
  return {
    id: doc._id.toString(),
    type: doc.type,
    title: doc.title,
    provider: doc.provider ?? null,
    amountCents: doc.amountCents,
    interval: doc.interval,
    startDate: doc.startDate,
    nextDue: doc.nextDue,
    status: doc.status ?? (doc.active === false ? "paused" : "active"),
    costType: doc.costType ?? (doc.type === "expense" ? inferCostType(doc.title) : "other"),
    categoryId: doc.categoryId ?? null,
    accountId: doc.accountId ?? null,
    endDate: doc.endDate ?? null,
    cancelledOn: doc.cancelledOn ?? null,
    noticePeriod: doc.noticePeriod ?? null,
    note: doc.note ?? null,
  };
}

export type FinanceData = {
  today: string;
  timeZone: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
};

/**
 * Alle Daten eines Nutzers fuer die Berechnungen. Fuer eine private
 * Finanzverwaltung (einige tausend Buchungen) ist das schneller und vor
 * allem konsistenter als viele Teilabfragen.
 */
export async function loadFinanceData(userId: string): Promise<FinanceData> {
  await ensureIndexes();
  const [settings, accountDocs, categoryDocs, transactionDocs, recurringDocs] = await Promise.all([
    getSettings(userId),
    accounts.find({ userId }).sort({ archived: 1, createdAt: 1 }).toArray(),
    categories.find({ userId }).sort({ kind: 1, name: 1 }).toArray(),
    transactions
      .find({ userId }, { projection: { importHash: 0, legacyPlannedId: 0, userId: 0 } })
      .sort({ date: -1, createdAt: -1 })
      .toArray(),
    recurring.find({ userId }).sort({ nextDue: 1 }).toArray(),
  ]);

  return {
    today: todayIn(settings.timeZone),
    timeZone: settings.timeZone,
    accounts: accountDocs.map(toAccount),
    categories: categoryDocs.map(toCategory),
    transactions: transactionDocs.map((doc) => toTransaction(doc as WithId<TransactionDoc>)),
    recurring: recurringDocs.map(toRecurring),
  };
}

/** Pro Anfrage nur einmal laden, auch wenn Layout und Seite die Daten brauchen. */
export const getFinanceData = cache(loadFinanceData);
