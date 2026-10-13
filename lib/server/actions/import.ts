"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isISODate } from "../../domain/calendar";
import { duplicateKey, MAX_IMPORT_ROWS } from "../../import";
import { categories, ensureIndexes, imports, transactions, wishes } from "../db";
import { authorize, fail, fileNameSchema, firstIssue, ok, ownsAccount, refresh, type ActionResult } from "./shared";

/**
 * CSV-Import. Die Datei wird im Browser gelesen und zugeordnet
 * (lib/import.ts); hier wird jede Zeile erneut geprueft, bevor sie
 * gespeichert wird. Jeder Import bekommt eine ID (Collection "imports"),
 * damit er sich vollstaendig rueckgaengig machen laesst.
 */

const rowSchema = z.object({
  date: z.string().refine(isISODate, "Ungültiges Datum"),
  title: z.string().trim().min(1).max(120),
  amountCents: z.number().int().positive().max(100_000_000_00),
  type: z.enum(["income", "expense"]),
  category: z.string().trim().max(40).nullable(),
  note: z.string().trim().max(500).nullable(),
});

const importSchema = z.object({
  accountId: z.string().min(1, "Bitte ein Konto wählen"),
  fileName: fileNameSchema,
  rows: z.array(rowSchema).min(1, "Keine Zeilen ausgewählt").max(MAX_IMPORT_ROWS, `Höchstens ${MAX_IMPORT_ROWS} Zeilen pro Import`),
});

export type ImportInput = z.input<typeof importSchema>;
export type ImportResult = { ok: true; imported: number; message: string } | { ok: false; error: string };

/** Welche Zeilen gibt es schon (gleicher Tag, Typ, Betrag, Bezeichnung)? */
export async function findExistingImportKeys(keys: string[]): Promise<string[]> {
  const auth = await authorize("import");
  if ("error" in auth) return [];
  const wanted = keys.filter((key) => typeof key === "string").slice(0, MAX_IMPORT_ROWS);
  const dates = wanted.map((key) => key.slice(0, 10)).filter(isISODate).sort();
  if (dates.length === 0) return [];

  const docs = await transactions
    .find(
      { userId: auth.userId, date: { $gte: dates[0], $lte: dates[dates.length - 1] } },
      { projection: { date: 1, type: 1, amountCents: 1, title: 1, importHash: 1 } },
    )
    .toArray();
  const existing = new Set<string>();
  for (const doc of docs) {
    existing.add(duplicateKey(doc.date, doc.type, doc.amountCents, doc.title));
    if (doc.importHash) existing.add(doc.importHash);
  }
  return wanted.filter((key) => existing.has(key));
}

export async function importTransactions(input: ImportInput): Promise<ImportResult> {
  const auth = await authorize("import");
  if ("error" in auth) return auth.error as ImportResult;
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error)) as ImportResult;
  const { accountId, fileName, rows } = parsed.data;
  if (!(await ownsAccount(auth.userId, accountId))) return { ok: false, error: "Konto nicht gefunden" };
  await ensureIndexes();

  // Kategorien per Name zuordnen; unbekannte Namen bleiben ohne Kategorie
  const known = await categories.find({ userId: auth.userId }).toArray();
  const categoryId = (name: string | null, kind: "income" | "expense") => {
    if (!name) return null;
    const match = known.find((doc) => doc.kind === kind && doc.name.toLowerCase() === name.toLowerCase());
    return match ? match._id.toString() : null;
  };

  const now = new Date();
  const importId = randomUUID();
  const dates = rows.map((row) => row.date).sort();
  await imports.insertOne({
    _id: importId,
    userId: auth.userId,
    kind: "transactions",
    fileName,
    accountId,
    rowCount: rows.length,
    dateFrom: dates[0],
    dateTo: dates[dates.length - 1],
    createdAt: now,
    undoneAt: null,
  });
  try {
    await transactions.insertMany(
      rows.map((row) => ({
        userId: auth.userId,
        type: row.type,
        status: "booked" as const,
        amountCents: row.amountCents,
        date: row.date,
        title: row.title,
        note: row.note,
        categoryId: categoryId(row.category, row.type),
        accountId,
        transferGroupId: null,
        recurringId: null,
        recurringDue: null,
        importHash: duplicateKey(row.date, row.type, row.amountCents, row.title),
        importId,
        createdAt: now,
      })),
    );
  } catch (error) {
    // Teilweise geschriebene Zeilen wieder entfernen, der Import gilt als nicht erfolgt
    await transactions.deleteMany({ userId: auth.userId, importId });
    await imports.deleteOne({ _id: importId, userId: auth.userId });
    throw error;
  }
  refresh();
  return { ok: true, imported: rows.length, message: `${rows.length} Buchungen importiert` };
}

/**
 * Einen Import vollstaendig rueckgaengig machen: alle Datensaetze mit seiner
 * importId werden geloescht, auch wenn sie danach bearbeitet wurden. Bei
 * Wunsch-Importen verschwinden auch daraus eingeplante, noch offene Zahlungen.
 */
export async function undoImport(importId: string): Promise<ActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  if (typeof importId !== "string" || !importId) return fail("Import nicht gefunden");

  const doc = await imports.findOne({ _id: importId, userId: auth.userId });
  if (!doc) return fail("Import nicht gefunden");
  if (doc.undoneAt) return fail("Dieser Import wurde bereits rückgängig gemacht.");

  let deleted = 0;
  if (doc.kind === "wishes") {
    const linked = await wishes
      .find({ userId: auth.userId, importId, transactionId: { $type: "string" } }, { projection: { transactionId: 1 } })
      .toArray();
    const wishIds = linked.map((wish) => wish._id.toString());
    if (wishIds.length > 0) await transactions.deleteMany({ userId: auth.userId, wishId: { $in: wishIds }, status: "pending" });
    deleted = (await wishes.deleteMany({ userId: auth.userId, importId })).deletedCount;
  } else {
    deleted = (await transactions.deleteMany({ userId: auth.userId, importId })).deletedCount;
  }

  await imports.updateOne({ _id: importId, userId: auth.userId }, { $set: { undoneAt: new Date(), undoneCount: deleted } });
  refresh();
  return ok(`Import rückgängig gemacht: ${deleted} ${doc.kind === "wishes" ? "Wünsche" : "Buchungen"} gelöscht`);
}
