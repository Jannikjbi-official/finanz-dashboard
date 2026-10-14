import "server-only";
import type { ObjectId, WithId } from "mongodb";
import { followingDue } from "../domain/recurring";
import type { TrashEntry } from "../domain/types";
import { formatMoney } from "../format";
import { toRecurring } from "./convert";
import { importTrash, imports, recurring, toObjectId, transactions, type TransactionDoc, type TrashDoc } from "./db";
import { LEGACY_PREFIX, parseLegacyId } from "./import-undo";
import { reopenLinkedDues } from "./recurring-link";

/** So lange bleiben einzeln geloeschte Buchungen im Papierkorb. */
export const TRASH_DAYS = 30;

type TxDoc = WithId<TransactionDoc>;

/** "Lidl, 12,50 €" fuer eine Buchung, "Transfer, 50,00 €" fuer ein Paar, sonst "3 Buchungen". */
export function trashLabel(docs: Array<Pick<TransactionDoc, "title" | "amountCents" | "transferGroupId">>) {
  const groups = new Set(docs.map((doc) => doc.transferGroupId).filter(Boolean));
  if (docs.length === 1 || (docs.length === 2 && groups.size === 1)) {
    const doc = docs[0];
    return `${doc.transferGroupId ? "Transfer" : doc.title}, ${formatMoney(doc.amountCents)}`;
  }
  return `${docs.length} Buchungen`;
}

/**
 * Buchungen loeschen und vorher als ein Eintrag in den Papierkorb legen.
 * Termine regelmaessiger Zahlungen, die sie erledigt haben, werden wieder
 * offen - sonst zaehlten sie weder als bezahlt noch als offen.
 */
export async function trashTransactions(userId: string, docs: TxDoc[], options: { label?: string; importId?: string } = {}) {
  if (docs.length === 0) return null;
  const now = new Date();
  const { insertedId } = await importTrash.insertOne({
    userId,
    importId: options.importId ?? null,
    kind: "transactions",
    docs,
    label: options.label ?? trashLabel(docs),
    deletedAt: now,
    // Rueckgaengig gemachte Importe bleiben als Sicherung, bis sie endgueltig geloescht werden
    expiresAt: options.importId ? null : new Date(now.getTime() + TRASH_DAYS * 86_400_000),
  });
  await reopenLinkedDues(userId, docs);
  const deleted = (await transactions.deleteMany({ userId, _id: { $in: docs.map((doc) => doc._id) } })).deletedCount;
  return { trashId: insertedId.toString(), deleted };
}

export async function listTrash(userId: string, limit = 30): Promise<TrashEntry[]> {
  const docs = await importTrash
    .aggregate<{ _id: ObjectId; label?: string; importId?: string | null; deletedAt: Date; expiresAt?: Date | null; count: number }>([
      { $match: { userId, kind: "transactions" } },
      { $sort: { deletedAt: -1 } },
      { $limit: limit },
      { $project: { label: 1, importId: 1, deletedAt: 1, expiresAt: 1, count: { $size: "$docs" } } },
    ])
    .toArray();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    label: doc.label ?? (doc.importId ? "Rückgängig gemachter Import" : "Gelöschte Buchungen"),
    count: doc.count,
    deletedAt: doc.deletedAt.toISOString(),
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
    fromImport: Boolean(doc.importId),
  }));
}

export function countTrash(userId: string) {
  return importTrash.countDocuments({ userId, kind: "transactions" });
}

export type RestoreResult =
  | { ok: true; restored: number; unlinked: number }
  | { ok: false; error: string };

/**
 * Einen Papierkorb-Eintrag zurueckholen: Buchungen mit ihrer alten ID wieder
 * anlegen. Zuordnungen zu regelmaessigen Zahlungen gelten nur, wenn der
 * Termin noch offen ist - sonst wurde er inzwischen anders erledigt, und
 * die Buchung kommt ohne Zuordnung zurueck (nichts zaehlt doppelt).
 */
export async function restoreTrash(userId: string, trashId: string): Promise<RestoreResult> {
  const _id = toObjectId(trashId);
  if (!_id) return { ok: false, error: "Eintrag nicht gefunden" };
  const found = await importTrash.findOne({ _id, userId, kind: "transactions" }, { projection: { importId: 1, "docs.importHash": 1 } });
  if (!found) return { ok: false, error: "Eintrag nicht gefunden – vielleicht schon wiederhergestellt oder abgelaufen." };
  if (found.importId) {
    // Wer nach dem Rueckgaengigmachen neu importiert hat, bekaeme sonst alles doppelt
    const hashes = (found.docs as Array<{ importHash?: unknown }>).map((doc) => doc.importHash).filter((hash): hash is string => typeof hash === "string");
    if (hashes.length > 0 && (await transactions.countDocuments({ userId, importHash: { $in: hashes } }, { limit: 1 })) > 0) {
      return { ok: false, error: "Diese Buchungen wurden inzwischen neu importiert – Wiederherstellen würde sie doppelt anlegen." };
    }
  }

  // Den Eintrag beim Herausnehmen entfernen: ein Doppelklick findet ihn nicht mehr
  const entry = await importTrash.findOneAndDelete({ _id, userId, kind: "transactions" });
  if (!entry) return { ok: false, error: "Schon wiederhergestellt." };
  const docs = entry.docs as TxDoc[];

  const present = new Set(
    (await transactions.find({ userId, _id: { $in: docs.map((doc) => doc._id) } }, { projection: { _id: 1 } }).toArray()).map((doc) => doc._id.toString()),
  );
  const missing = docs.filter((doc) => !present.has(doc._id.toString()));

  // Erledigte Termine nur wieder zuordnen, wenn sie noch der naechste offene sind (aelteste zuerst)
  let unlinked = 0;
  const linked = missing.filter((doc) => doc.recurringId && doc.recurringDue).sort((a, b) => a.recurringDue!.localeCompare(b.recurringDue!));
  for (const doc of linked) {
    const recurringId = toObjectId(doc.recurringId);
    const current = recurringId ? await recurring.findOne({ _id: recurringId, userId }) : null;
    let relinked = false;
    if (current && current.nextDue === doc.recurringDue) {
      const next = followingDue(toRecurring(current), doc.recurringDue);
      const moved = await recurring.updateOne({ _id: current._id, userId, nextDue: doc.recurringDue }, { $set: { nextDue: next, updatedAt: new Date() } });
      relinked = moved.modifiedCount === 1;
    }
    if (!relinked) {
      doc.recurringId = null;
      doc.recurringDue = null;
      unlinked += 1;
    }
  }

  if (missing.length > 0) {
    try {
      // Immer dem eigenen Konto zuordnen - auch wenn der Eintrag aus einer hochgeladenen Sicherung stammt
      await transactions.insertMany(missing.map((doc) => ({ ...doc, userId, updatedAt: new Date() })), { ordered: false });
    } catch (error) {
      // Doppelte IDs (parallel wiederhergestellt) sind kein Fehler, alles andere schon
      if (!(error instanceof Error && "code" in error && error.code === 11000)) {
        await importTrash.insertOne(entry);
        throw error;
      }
    }
  }

  if (entry.importId) await reopenImport(userId, entry.importId);
  return { ok: true, restored: missing.length, unlinked };
}

/** Der Import gilt wieder als aktiv und laesst sich erneut rueckgaengig machen. */
async function reopenImport(userId: string, importId: string) {
  if (importId.startsWith(LEGACY_PREFIX)) {
    // Alte Importe erkennt die Liste wieder an Anlagezeitpunkt und importHash
    const createdAt = parseLegacyId(importId);
    if (createdAt) await imports.deleteOne({ userId, createdAt, fileName: null, undoneAt: { $type: "date" } });
    return;
  }
  await imports.updateOne({ _id: importId, userId }, { $set: { undoneAt: null }, $unset: { undoneCount: "" } });
}

/** Endgueltig loeschen: einen Eintrag oder (ohne ID) den ganzen Papierkorb. */
export async function purgeTrash(userId: string, trashId?: string) {
  if (trashId === undefined) return (await importTrash.deleteMany({ userId, kind: "transactions" })).deletedCount;
  const _id = toObjectId(trashId);
  if (!_id) return 0;
  return (await importTrash.deleteOne({ _id, userId })).deletedCount;
}
