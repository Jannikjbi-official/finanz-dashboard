"use server";

import { z } from "zod";
import { isISODate } from "../../domain/calendar";
import { duplicateKey, MAX_IMPORT_ROWS } from "../../import";
import { categories, ensureIndexes, transactions } from "../db";
import { authorize, fail, firstIssue, ownsAccount, refresh } from "./shared";

/**
 * CSV-Import. Die Datei wird im Browser gelesen und zugeordnet
 * (lib/import.ts); hier wird jede Zeile erneut geprueft, bevor sie
 * gespeichert wird.
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
  const { accountId, rows } = parsed.data;
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
      createdAt: now,
    })),
  );
  refresh();
  return { ok: true, imported: rows.length, message: `${rows.length} Buchungen importiert` };
}
