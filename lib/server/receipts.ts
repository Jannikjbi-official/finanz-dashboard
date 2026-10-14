import "server-only";
import { Binary, ObjectId } from "mongodb";
import { ensureIndexes, importTrash, receipts, toObjectId, transactions, type ReceiptType } from "./db";

/**
 * Belege (Foto oder PDF) zu Buchungen. Liegen in der eigenen Datenbank
 * (Collection "receipts") und werden nur an den Eigentuemer ausgeliefert.
 * Nicht Teil der JSON-Sicherung, damit die Datei handlich bleibt.
 */

export const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
export const MAX_RECEIPTS_PER_TRANSACTION = 5;

export type ReceiptInfo = { id: string; fileName: string; contentType: ReceiptType; size: number; createdAt: string };

/** Dateityp am Inhalt erkennen, nicht an Endung oder Angabe des Browsers. */
export function sniffType(bytes: Uint8Array): ReceiptType | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  return null;
}

/** Dateiname fuer Anzeige und Download: ohne Pfad und Steuerzeichen, hoechstens 120 Zeichen. */
export function cleanFileName(name: string, type: ReceiptType) {
  const base = name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 120);
  const ext = type === "application/pdf" ? "pdf" : type.split("/")[1].replace("jpeg", "jpg");
  return base || `beleg.${ext}`;
}

export type AddResult = { ok: true; id: string } | { ok: false; error: string };

export async function addReceipt(userId: string, transactionId: string, file: { name: string; bytes: Uint8Array }): Promise<AddResult> {
  const _id = toObjectId(transactionId);
  if (!_id) return { ok: false, error: "Buchung nicht gefunden" };
  await ensureIndexes();
  if (file.bytes.byteLength === 0) return { ok: false, error: "Die Datei ist leer." };
  if (file.bytes.byteLength > MAX_RECEIPT_BYTES) return { ok: false, error: "Die Datei ist zu groß (höchstens 2 MB)." };
  const type = sniffType(file.bytes);
  if (!type) return { ok: false, error: "Nur Fotos (JPEG, PNG, WebP) und PDF-Dateien." };

  // Zaehler zuerst hochsetzen, gebunden an die Obergrenze: parallele Uploads ueberschreiten sie nicht
  const counted = await transactions.updateOne(
    { _id, userId, $or: [{ receiptCount: { $exists: false } }, { receiptCount: { $lt: MAX_RECEIPTS_PER_TRANSACTION } }] },
    { $inc: { receiptCount: 1 } },
  );
  if (counted.matchedCount === 0) {
    const exists = await transactions.countDocuments({ _id, userId }, { limit: 1 });
    return { ok: false, error: exists ? `Höchstens ${MAX_RECEIPTS_PER_TRANSACTION} Belege pro Buchung.` : "Buchung nicht gefunden" };
  }
  try {
    const { insertedId } = await receipts.insertOne({
      userId,
      transactionId,
      fileName: cleanFileName(file.name, type),
      contentType: type,
      size: file.bytes.byteLength,
      data: new Binary(file.bytes),
      createdAt: new Date(),
    });
    return { ok: true, id: insertedId.toString() };
  } catch (error) {
    await transactions.updateOne({ _id, userId }, { $inc: { receiptCount: -1 } });
    throw error;
  }
}

export async function listReceipts(userId: string, transactionId: string): Promise<ReceiptInfo[]> {
  const docs = await receipts.find({ userId, transactionId }, { projection: { data: 0 } }).sort({ createdAt: 1 }).toArray();
  return docs.map((doc) => ({ id: doc._id.toString(), fileName: doc.fileName, contentType: doc.contentType, size: doc.size, createdAt: doc.createdAt.toISOString() }));
}

export async function getReceipt(userId: string, id: string) {
  const _id = toObjectId(id);
  return _id ? receipts.findOne({ _id, userId }) : null;
}

export async function deleteReceipt(userId: string, id: string) {
  const _id = toObjectId(id);
  if (!_id) return false;
  const doc = await receipts.findOneAndDelete({ _id, userId }, { projection: { transactionId: 1 } });
  if (!doc) return false;
  const txId = toObjectId(doc.transactionId);
  if (txId) await transactions.updateOne({ _id: txId, userId, receiptCount: { $gt: 0 } }, { $inc: { receiptCount: -1 } });
  return true;
}

/**
 * Belege ohne Buchung entfernen (Buchung endgueltig geloescht oder aus dem
 * Papierkorb abgelaufen). Belege von Buchungen im Papierkorb bleiben.
 */
export async function cleanupReceipts(): Promise<number> {
  const ids = await receipts.distinct("transactionId");
  if (ids.length === 0) return 0;
  const objectIds = ids.map((id) => toObjectId(id)).filter((id): id is ObjectId => id !== null);
  const alive = new Set((await transactions.find({ _id: { $in: objectIds } }, { projection: { _id: 1 } }).toArray()).map((doc) => doc._id.toString()));
  const trashed = new Set(
    (await importTrash.aggregate<{ _id: ObjectId }>([{ $unwind: "$docs" }, { $match: { "docs._id": { $in: objectIds } } }, { $project: { _id: "$docs._id" } }]).toArray()).map(
      (doc) => doc._id.toString(),
    ),
  );
  const orphaned = ids.filter((id) => !alive.has(id) && !trashed.has(id));
  if (orphaned.length === 0) return 0;
  return (await receipts.deleteMany({ transactionId: { $in: orphaned } })).deletedCount;
}
