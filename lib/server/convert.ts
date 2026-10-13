import type { WithId } from "mongodb";
import { inferCostType } from "../domain/labels";
import type { Account, Category, ImportInfo, Recurring, Transaction, Wish } from "../domain/types";
import type { AccountDoc, CategoryDoc, ImportDoc, RecurringDoc, TransactionDoc, WishDoc } from "./db";

/**
 * Dokumente in die Fachtypen aus lib/domain uebersetzen. Fehlende Felder aus
 * Altdaten bekommen hier ihre Standardwerte. Ohne "server-only", damit auch
 * die Kommandozeilen-Skripte dieselbe Uebersetzung nutzen.
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
    bankPending: Boolean(doc.bankPending),
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

export function toWish(doc: WithId<WishDoc>): Wish {
  return {
    id: doc._id.toString(),
    title: doc.title,
    amountCents: doc.amountCents,
    targetDate: doc.targetDate ?? null,
    status: doc.status ?? "idea",
    priority: doc.priority ?? "normal",
    group: doc.group ?? null,
    link: doc.link ?? null,
    note: doc.note ?? null,
    categoryId: doc.categoryId ?? null,
    transactionId: doc.transactionId ?? null,
    importId: doc.importId ?? null,
  };
}

export function toImportInfo(doc: ImportDoc): ImportInfo {
  return {
    id: doc._id,
    kind: doc.kind,
    fileName: doc.fileName ?? null,
    rowCount: doc.rowCount,
    dateFrom: doc.dateFrom ?? null,
    dateTo: doc.dateTo ?? null,
    createdAt: doc.createdAt.toISOString(),
    undoneAt: doc.undoneAt ? doc.undoneAt.toISOString() : null,
    undoneCount: doc.undoneCount ?? null,
  };
}
