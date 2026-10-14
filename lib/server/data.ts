import "server-only";
import { cache } from "react";
import type { WithId } from "mongodb";
import { todayIn } from "../domain/calendar";
import type { Account, Category, ImportInfo, Recurring, Transaction, Wish } from "../domain/types";
import type { CategoryRule } from "../domain/rules";
import { toAccount, toCategory, toImportInfo, toRecurring, toRule, toTransaction, toWish } from "./convert";
import { accounts, categories, db, ensureIndexes, imports, recurring, rules, transactions, wishes, type TransactionDoc } from "./db";
import { LEGACY_PREFIX, listLegacyImports } from "./import-undo";
import { getSettings } from "./user-data";

export { toAccount, toCategory, toRecurring, toTransaction, toWish };

/**
 * Lesezugriff. Jede Abfrage ist an die userId gebunden; die Uebersetzung in
 * die Fachtypen steckt in ./convert (auch von Skripten genutzt).
 */

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

/** Wuensche, offene zuerst, darin nach Termin (ohne Termin zuletzt). */
export async function loadWishes(userId: string): Promise<Wish[]> {
  await ensureIndexes();
  const docs = await wishes.find({ userId }).sort({ targetDate: 1, createdAt: 1 }).toArray();
  return docs.map(toWish);
}

/** Die letzten Importe, neueste zuerst. */
export async function loadImports(userId: string, kind: ImportInfo["kind"], limit = 10): Promise<ImportInfo[]> {
  const docs = await imports.find({ userId, kind }).sort({ createdAt: -1 }).limit(limit).toArray();
  const list = docs.map(toImportInfo);
  if (kind !== "transactions") return list;

  // Kontoimporte aus der Zeit vor der Import-ID ebenfalls anzeigen
  const legacy = await listLegacyImports(db, userId, limit);
  for (const batch of legacy) {
    list.push({
      id: `${LEGACY_PREFIX}${batch.createdAt.toISOString()}`,
      kind: "transactions",
      fileName: null,
      rowCount: batch.count,
      dateFrom: batch.dateFrom,
      dateTo: batch.dateTo,
      createdAt: batch.createdAt.toISOString(),
      undoneAt: null,
      undoneCount: null,
      legacy: true,
    });
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/** Kategorisierungsregeln in ihrer Reihenfolge. */
export async function loadRules(userId: string): Promise<CategoryRule[]> {
  const docs = await rules.find({ userId }).sort({ order: 1, createdAt: 1 }).toArray();
  return docs.map(toRule);
}
