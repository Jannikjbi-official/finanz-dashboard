"use server";

import { revalidatePath } from "next/cache";
import { categories, ensureIndexes, transactions } from "../../mongo";
import { requireUser } from "../../session";
import { limitUser } from "../rate-limit";
import { ownedRef } from "../ownership";
import {
  duplicateKey,
  guessMapping,
  mapRows,
  mappingProblems,
  MAX_IMPORT_BYTES,
  parseTable,
  type ImportMapping,
  type ImportRow,
} from "../../import";

export type PreviewResult =
  | { ok: false; error: string }
  | {
      ok: true;
      header: string[];
      mapping: ImportMapping;
      problems: string[];
      rows: Array<ImportRow & { duplicate: boolean }>;
      stats: { total: number; valid: number; invalid: number; duplicates: number };
      unknownCategories: string[];
    };

function checkSize(text: string) {
  if (!text.trim()) return "Die Datei ist leer.";
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) return "Die Datei ist größer als 2 MB.";
  return null;
}

/** Vorhandene Buchungen im Zeitraum des Imports als Dubletten-Schluessel. */
async function existingKeys(userId: string, rows: ImportRow[]) {
  const dates = rows.map((row) => row.date).filter((date): date is string => Boolean(date)).sort();
  if (dates.length === 0) return new Set<string>();

  const docs = await transactions
    .find(
      { userId, date: { $gte: dates[0], $lte: dates[dates.length - 1] } },
      { projection: { date: 1, type: 1, amountCents: 1, title: 1, importHash: 1 } },
    )
    .toArray();

  const keys = new Set<string>();
  for (const doc of docs) {
    keys.add(duplicateKey(doc.date, doc.type, doc.amountCents, doc.title));
    if (doc.importHash) keys.add(doc.importHash);
  }
  return keys;
}

function markDuplicates(rows: ImportRow[], existing: Set<string>) {
  const seen = new Set<string>();
  return rows.map((row) => {
    // Gleiche Zeile zweimal in der Datei: die zweite gilt als Dublette
    const duplicate = !row.error && (existing.has(row.key) || seen.has(row.key));
    if (!row.error) seen.add(row.key);
    return { ...row, duplicate };
  });
}

export async function previewImport(text: string, mapping: ImportMapping | null): Promise<PreviewResult> {
  const user = await requireUser();
  const limit = await limitUser(user.id, "write");
  if (!limit.allowed) return { ok: false, error: "Zu viele Anfragen – bitte kurz warten." };

  const sizeError = checkSize(text);
  if (sizeError) return { ok: false, error: sizeError };

  const table = parseTable(text);
  if (table.header.length < 2) {
    return { ok: false, error: "Keine Tabelle erkannt. Erwartet wird eine CSV-Datei mit Kopfzeile." };
  }

  const effective = mapping ?? guessMapping(table.header);
  const problems = mappingProblems(effective);
  const mapped = problems.length > 0 ? [] : mapRows(table, effective);
  const rows = markDuplicates(mapped, await existingKeys(user.id, mapped));

  const known = new Set(
    (await categories.find({ userId: user.id }, { projection: { name: 1 } }).toArray()).map((c) => c.name.toLowerCase()),
  );
  const unknownCategories = [
    ...new Set(rows.map((row) => row.category).filter((name): name is string => Boolean(name) && !known.has(name!.toLowerCase()))),
  ].slice(0, 30);

  return {
    ok: true,
    header: table.header,
    mapping: effective,
    problems,
    rows: rows.slice(0, 300),
    stats: {
      total: rows.length,
      valid: rows.filter((row) => !row.error).length,
      invalid: rows.filter((row) => row.error).length,
      duplicates: rows.filter((row) => row.duplicate).length,
    },
    unknownCategories,
  };
}

export type CommitResult = { ok: false; error: string } | { ok: true; imported: number; skipped: number; createdCategories: string[] };

export async function commitImport(input: {
  text: string;
  mapping: ImportMapping;
  accountId: string | null;
  skipDuplicates: boolean;
  createCategories: boolean;
}): Promise<CommitResult> {
  const user = await requireUser();
  const limit = await limitUser(user.id, "import");
  if (!limit.allowed) return { ok: false, error: `Zu viele Importe – bitte in ${Math.ceil(limit.retryAfterSeconds / 60)} Minuten erneut.` };
  await ensureIndexes();

  const sizeError = checkSize(input.text);
  if (sizeError) return { ok: false, error: sizeError };

  const problems = mappingProblems(input.mapping);
  if (problems.length > 0) return { ok: false, error: problems[0] };

  const accountId = await ownedRef(user.id, "accounts", input.accountId);
  if (accountId === false) return { ok: false, error: "Konto nicht gefunden" };

  // Alles noch einmal auf dem Server lesen - nichts aus dem Browser uebernehmen
  const mapped = mapRows(parseTable(input.text), input.mapping);
  const rows = markDuplicates(mapped, await existingKeys(user.id, mapped));
  const accepted = rows.filter((row) => !row.error && !(input.skipDuplicates && row.duplicate));

  if (accepted.length === 0) return { ok: false, error: "Keine Zeile zum Übernehmen." };

  const existing = await categories.find({ userId: user.id }).toArray();
  const byName = new Map(existing.map((doc) => [`${doc.kind}:${doc.name.toLowerCase()}`, doc._id.toString()]));
  const createdCategories: string[] = [];

  if (input.createCategories) {
    for (const row of accepted) {
      if (!row.category) continue;
      const key = `${row.type}:${row.category.toLowerCase()}`;
      if (byName.has(key)) continue;
      const inserted = await categories.insertOne({
        userId: user.id,
        name: row.category.slice(0, 40),
        kind: row.type,
        color: row.type === "income" ? "#2e6a3e" : "#5b5f66",
        icon: "",
        budgetCents: null,
        createdAt: new Date(),
      });
      byName.set(key, inserted.insertedId.toString());
      createdCategories.push(row.category);
    }
  }

  const now = new Date();
  await transactions.insertMany(
    accepted.map((row) => ({
      userId: user.id,
      type: row.type,
      amountCents: row.amountCents,
      title: row.title,
      note: row.note,
      date: row.date!,
      dateEnd: null,
      datePrecision: "day" as const,
      categoryId: row.category ? (byName.get(`${row.type}:${row.category.toLowerCase()}`) ?? null) : null,
      accountId,
      recurringId: null,
      transferGroupId: null,
      importHash: row.key,
      createdAt: now,
    })),
  );

  revalidatePath("/", "layout");
  return { ok: true, imported: accepted.length, skipped: rows.length - accepted.length, createdCategories };
}
