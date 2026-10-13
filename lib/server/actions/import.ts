"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isISODate } from "../../domain/calendar";
import { duplicateKey, MAX_IMPORT_ROWS } from "../../import";
import { categories, ensureIndexes, imports, transactions, wishes, type TransactionDoc } from "../db";
import { authorize, fail, fileNameSchema, firstIssue, ok, optionalId, ownsAccount, refresh, type ActionResult } from "./shared";

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
  status: z.enum(["booked", "pending", "planned"]).default("booked"),
  transfer: z.boolean().default(false),
  /** Abweichendes Konto aus der Spalte "Konto"; sonst das Konto des Imports. */
  accountId: optionalId,
  category: z.string().trim().max(40).nullable(),
  note: z.string().trim().max(500).nullable(),
});

const importSchema = z.object({
  accountId: z.string().min(1, "Bitte ein Konto wählen"),
  fileName: fileNameSchema,
  rows: z.array(rowSchema).min(1, "Keine Zeilen ausgewählt").max(MAX_IMPORT_ROWS, `Höchstens ${MAX_IMPORT_ROWS} Zeilen pro Import`),
  /** Gegenkonto fuer Umbuchungen (z. B. Revolut). Ohne: nur dieses Konto wird gebucht. */
  counterAccountId: optionalId,
  /** Kategorien aus der Datei anlegen, die es noch nicht gibt. */
  createCategories: z.boolean().default(false),
});

export type ImportInput = z.input<typeof importSchema>;
export type ImportResult = { ok: true; imported: number; skipped: number; message: string } | { ok: false; error: string };

/** Schluessel einer vorhandenen Buchung fuer den Dublettenvergleich. */
function existingKey(doc: Pick<TransactionDoc, "date" | "type" | "amountCents" | "title" | "importHash">) {
  return doc.importHash ?? duplicateKey(doc.date, doc.type, doc.amountCents, doc.title);
}

/**
 * Welche Zeilen gibt es schon (gleicher Tag, Typ, Betrag, Bezeichnung)? Ein
 * Schluessel kommt so oft zurueck, wie es passende Buchungen gibt - zwei
 * gleiche Einkaeufe am selben Tag bleiben so zwei Zeilen. Vorgemerkte
 * Umsaetze zaehlen nicht, sie werden beim Import ersetzt.
 */
export async function findExistingImportKeys(keys: string[]): Promise<string[]> {
  const auth = await authorize();
  if ("error" in auth) return [];
  const wanted = new Set(keys.filter((key) => typeof key === "string").slice(0, MAX_IMPORT_ROWS));
  const dates = [...wanted].map((key) => key.slice(0, 10)).filter(isISODate).sort();
  if (dates.length === 0) return [];

  const docs = await transactions
    .find(
      { userId: auth.userId, date: { $gte: dates[0], $lte: dates[dates.length - 1] }, bankPending: { $ne: true } },
      { projection: { date: 1, type: 1, amountCents: 1, title: 1, importHash: 1 } },
    )
    .toArray();
  return docs.map(existingKey).filter((key) => wanted.has(key));
}

export async function importTransactions(input: ImportInput): Promise<ImportResult> {
  const auth = await authorize("import");
  if ("error" in auth) return auth.error as ImportResult;
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error)) as ImportResult;
  const { accountId, fileName, counterAccountId, createCategories } = parsed.data;

  // Alle beteiligten Konten muessen dem Nutzer gehoeren
  const accountIds = new Set([accountId, ...parsed.data.rows.map((row) => row.accountId ?? accountId)]);
  if (counterAccountId) accountIds.add(counterAccountId);
  for (const id of accountIds) {
    if (!(await ownsAccount(auth.userId, id))) return { ok: false, error: "Konto nicht gefunden" };
  }
  await ensureIndexes();

  // Dubletten auch auf dem Server: schon importierte Zeilen nicht noch einmal
  // anlegen (Doppelklick, zweiter Tab, gleiche Datei erneut)
  const dates = parsed.data.rows.map((row) => row.date).sort();
  const previous = await transactions
    .find(
      { userId: auth.userId, importHash: { $type: "string" }, bankPending: { $ne: true }, date: { $gte: dates[0], $lte: dates[dates.length - 1] } },
      { projection: { importHash: 1 } },
    )
    .toArray();
  const seen = new Map<string, number>();
  for (const doc of previous) seen.set(doc.importHash!, (seen.get(doc.importHash!) ?? 0) + 1);
  const rows = parsed.data.rows.filter((row) => {
    const key = duplicateKey(row.date, row.type, row.amountCents, row.title);
    const left = seen.get(key) ?? 0;
    if (left > 0) seen.set(key, left - 1);
    return left === 0;
  });
  const skipped = parsed.data.rows.length - rows.length;
  if (rows.length === 0) return { ok: true, imported: 0, skipped, message: "Alle Zeilen sind schon importiert" };

  // Kategorien per Name zuordnen; fehlende auf Wunsch anlegen
  const known = await categories.find({ userId: auth.userId }).toArray();
  if (createCategories) {
    const missing = new Map<string, { name: string; kind: "income" | "expense" }>();
    for (const row of rows) {
      if (!row.category || row.transfer) continue;
      const exists = known.some((doc) => doc.kind === row.type && doc.name.toLowerCase() === row.category!.toLowerCase());
      if (!exists) missing.set(`${row.type}|${row.category.toLowerCase()}`, { name: row.category, kind: row.type });
    }
    for (const entry of missing.values()) {
      try {
        const { insertedId } = await categories.insertOne({ ...entry, userId: auth.userId, color: "#8b8f94", createdAt: new Date() });
        known.push({ _id: insertedId, ...entry, userId: auth.userId, color: "#8b8f94", createdAt: new Date() });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
  }
  const categoryId = (name: string | null, kind: "income" | "expense") => {
    if (!name) return null;
    const match = known.find((doc) => doc.kind === kind && doc.name.toLowerCase() === name.toLowerCase());
    return match ? match._id.toString() : null;
  };

  const now = new Date();
  const importId = randomUUID();
  const docs: TransactionDoc[] = [];
  for (const row of rows) {
    const rowAccount = row.accountId ?? accountId;
    const base = {
      userId: auth.userId,
      amountCents: row.amountCents,
      date: row.date,
      title: row.title,
      note: row.note,
      recurringId: null,
      recurringDue: null,
      importId,
      createdAt: now,
    };
    const importHash = duplicateKey(row.date, row.type, row.amountCents, row.title);

    if (row.transfer && row.status === "booked") {
      // Umbuchung: aendert Kontostaende, zaehlt nie als Einnahme oder Ausgabe
      const transferGroupId = randomUUID();
      docs.push({ ...base, type: row.type, status: "booked", categoryId: null, accountId: rowAccount, transferGroupId, importHash });
      if (counterAccountId && counterAccountId !== rowAccount) {
        docs.push({
          ...base,
          type: row.type === "income" ? "expense" : "income",
          status: "booked",
          categoryId: null,
          accountId: counterAccountId,
          transferGroupId,
          importHash: null,
        });
      }
      continue;
    }

    docs.push({
      ...base,
      type: row.type,
      // Vorgemerkt und geplant veraendern den Kontostand noch nicht
      status: row.status === "booked" ? "booked" : "pending",
      bankPending: row.status === "pending",
      categoryId: categoryId(row.category, row.type),
      accountId: rowAccount,
      transferGroupId: null,
      importHash,
    });
  }

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
  let replaced = 0;
  try {
    // Vorgemerkte Umsaetze sind ein Schnappschuss der Bank: der neue Import
    // ersetzt die alten Vormerkungen derselben Konten
    const touched = [...new Set(docs.map((doc) => doc.accountId!))];
    replaced = (
      await transactions.deleteMany({
        userId: auth.userId,
        bankPending: true,
        status: "pending",
        accountId: { $in: touched },
        date: { $lte: dates[dates.length - 1] },
      })
    ).deletedCount;
    await transactions.insertMany(docs);
  } catch (error) {
    // Teilweise geschriebene Zeilen wieder entfernen, der Import gilt als nicht erfolgt
    await transactions.deleteMany({ userId: auth.userId, importId });
    await imports.deleteOne({ _id: importId, userId: auth.userId });
    throw error;
  }
  refresh();

  const parts = [`${rows.length} Buchungen importiert`];
  if (skipped) parts.push(`${skipped} schon vorhanden`);
  if (replaced) parts.push(`${replaced} alte Vormerkungen ersetzt`);
  return { ok: true, imported: rows.length, skipped, message: parts.join(", ") };
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
