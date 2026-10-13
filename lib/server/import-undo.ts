import type { Db, ObjectId, WithId } from "mongodb";
import { duplicateKey, type ImportRow } from "../import";
import type { TransactionDoc } from "./db";

/**
 * Einen alten CSV-Import (ohne Import-ID) anhand der Datei wiederfinden.
 *
 * Der Import legt alle Zeilen mit einem einzigen insertMany an: gleiche
 * userId, gleiches createdAt und je Zeile ein importHash aus Datum, Typ,
 * Betrag und Bezeichnung. Gesucht wird genau der eine Stapel, dessen
 * Buchungen alle zu Zeilen der Datei passen. Ist das nicht eindeutig, wird
 * nichts zum Loeschen vorgeschlagen.
 */

export type ImportBatch = {
  userId: string;
  createdAt: Date;
  docs: Array<WithId<TransactionDoc>>;
  /** Buchungen des Stapels, die zu keiner Zeile der Datei passen. */
  foreign: Array<WithId<TransactionDoc>>;
  /** Zeilen der Datei, zu denen im Stapel keine Buchung gehoert. */
  missingLines: number[];
  /** Nach dem Import veraenderte Buchungen (gehoeren trotzdem zum Import). */
  edited: Array<WithId<TransactionDoc>>;
};

export type BatchSearch =
  | { ok: true; batch: ImportBatch; others: ImportBatch[] }
  | { ok: false; reason: string; batches: ImportBatch[] };

/** Schluessel einer Zeile, genau wie ihn importTransactions gespeichert hat. */
export function rowKey(row: Pick<ImportRow, "date" | "type" | "amountCents" | "title">) {
  return duplicateKey(row.date!, row.type, row.amountCents, row.title.trim());
}

export async function findImportBatch(
  db: Db,
  rows: ImportRow[],
  options: { userId?: string; allowPartial?: boolean } = {},
): Promise<BatchSearch> {
  const valid = rows.filter((row) => !row.error && row.date);
  if (valid.length === 0) return { ok: false, reason: "Die Datei enthält keine lesbaren Zeilen.", batches: [] };

  const keys = [...new Set(valid.map(rowKey))];
  const transactions = db.collection<TransactionDoc>("transactions");
  const hits = await transactions
    .find({ importHash: { $in: keys }, ...(options.userId ? { userId: options.userId } : {}) })
    .toArray();

  // Kandidaten-Stapel: je Nutzer und Importzeitpunkt
  const stamps = new Map<string, { userId: string; createdAt: Date }>();
  for (const doc of hits) {
    if (!(doc.createdAt instanceof Date)) continue;
    stamps.set(`${doc.userId}|${doc.createdAt.getTime()}`, { userId: doc.userId, createdAt: doc.createdAt });
  }

  const batches: ImportBatch[] = [];
  for (const { userId, createdAt } of stamps.values()) {
    // Der ganze Stapel, auch Buchungen, deren Schluessel nicht in der Datei steht
    const docs = await transactions.find({ userId, createdAt, importHash: { $type: "string" } }).toArray();
    batches.push(compareBatch(userId, createdAt, docs, valid));
  }
  batches.sort((a, b) => b.docs.length - a.docs.length || b.createdAt.getTime() - a.createdAt.getTime());

  const complete = batches.filter(
    (batch) => batch.foreign.length === 0 && (options.allowPartial || batch.missingLines.length === 0),
  );

  if (batches.length === 0) {
    return { ok: false, reason: "Keine Buchungen aus dieser Datei gefunden – vielleicht wurde der Import schon gelöscht.", batches };
  }
  if (complete.length === 0) {
    const best = batches[0];
    const reason =
      best.foreign.length > 0
        ? `Der passende Import enthält ${best.foreign.length} Buchungen, die nicht in der Datei stehen.`
        : `Im passenden Import fehlen ${best.missingLines.length} Zeilen der Datei (Zeilen ${best.missingLines.join(", ")}).`;
    return { ok: false, reason: `${reason} Nicht eindeutig – es wird nichts gelöscht.`, batches };
  }
  if (complete.length > 1) {
    return {
      ok: false,
      reason: `Die Datei passt zu ${complete.length} verschiedenen Importen (mehrfach importiert oder mehrere Nutzer). Nicht eindeutig – es wird nichts gelöscht.`,
      batches,
    };
  }
  return { ok: true, batch: complete[0], others: batches.filter((batch) => batch !== complete[0]) };
}

/** Buchungen eines Stapels 1:1 den Zeilen der Datei zuordnen (gleiche Zeile darf mehrfach vorkommen). */
function compareBatch(userId: string, createdAt: Date, docs: Array<WithId<TransactionDoc>>, rows: ImportRow[]): ImportBatch {
  const open = new Map<string, number[]>();
  for (const row of rows) open.set(rowKey(row), [...(open.get(rowKey(row)) ?? []), row.line]);

  const foreign: Array<WithId<TransactionDoc>> = [];
  const edited: Array<WithId<TransactionDoc>> = [];
  for (const doc of docs) {
    const lines = open.get(doc.importHash ?? "");
    if (!lines || lines.length === 0) {
      foreign.push(doc);
      continue;
    }
    lines.shift();
    const original = doc.importHash === duplicateKey(doc.date, doc.type, doc.amountCents, doc.title);
    if (!original || doc.updatedAt || doc.recurringId || doc.transferGroupId || (doc.status ?? "booked") !== "booked") edited.push(doc);
  }
  const missingLines = [...open.values()].flat().sort((a, b) => a - b);
  return { userId, createdAt, docs, foreign, missingLines, edited };
}

/** Loescht genau die Buchungen des Stapels und prueft die Anzahl. */
export async function deleteImportBatch(db: Db, batch: ImportBatch) {
  const ids: ObjectId[] = batch.docs.map((doc) => doc._id);
  const result = await db
    .collection<TransactionDoc>("transactions")
    .deleteMany({ _id: { $in: ids }, userId: batch.userId, createdAt: batch.createdAt });
  return { expected: ids.length, deleted: result.deletedCount };
}
