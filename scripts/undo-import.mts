/**
 * Einen CSV-Import rueckgaengig machen, der noch ohne Import-ID angelegt wurde.
 *
 *   npm run db:undo-import -- <datei.csv>            Probelauf: zeigt, was geloescht wuerde
 *   npm run db:undo-import -- <datei.csv> --apply    sichern, dann loeschen
 *
 * Optionen:
 *   --email <adresse>   nur in den Daten dieses Nutzers suchen
 *   --allow-partial     auch loeschen, wenn beim Import einzelne Zeilen abgewaehlt waren
 *
 * Die Datei wird genau so gelesen wie im Import-Dialog. Geloescht werden nur
 * Buchungen, die zu einem einzigen Importvorgang gehoeren und Zeile fuer Zeile
 * zur Datei passen. Konten, regelmaessige Zahlungen, Kategorien und selbst
 * angelegte Buchungen bleiben unberuehrt. Vor dem Loeschen wird die ganze
 * Datenbank gesichert (backups/), die geloeschten Buchungen zusaetzlich einzeln.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BSON, type Db } from "mongodb";
import { todayIn } from "../lib/domain/calendar";
import { buildDashboard } from "../lib/domain/dashboard";
import { formatMoney } from "../lib/format";
import { guessMapping, mapRows, parseTable } from "../lib/import";
import { toAccount, toRecurring, toTransaction } from "../lib/server/convert";
import { deleteImportBatch, findImportBatch, type ImportBatch } from "../lib/server/import-undo";
import { backupDatabase } from "./lib/backup";
import { closeScriptDb, openScriptDb } from "./lib/db";

const args = process.argv.slice(2);
const file = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--email");
const apply = args.includes("--apply");
const allowPartial = args.includes("--allow-partial");
const email = args.includes("--email") ? args[args.indexOf("--email") + 1] : undefined;

if (!file) {
  console.error("CSV-Datei angeben, z. B.: npm run db:undo-import -- ~/Downloads/umsaetze.csv");
  process.exit(1);
}

// Wie im Import-Dialog: UTF-8, sonst Windows-1252
const buffer = await readFile(file);
let text = new TextDecoder("utf-8").decode(buffer);
if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
const table = parseTable(text);
const rows = mapRows(table, guessMapping(table.header));
const dates = rows.map((row) => row.date).filter(Boolean).sort() as string[];
const money = (cents: number) => formatMoney(cents).replace(/ /g, " ");

console.log(`Datei: ${path.basename(file)} – ${rows.length} Zeilen, ${dates[0]} bis ${dates.at(-1)}`);

const { client, db, label } = await openScriptDb();

try {
  console.log(`Datenbank: ${label}${apply ? "" : " (Probelauf – es wird nichts geändert)"}`);

  let userId: string | undefined;
  if (email) {
    const user = await db.collection("user").findOne({ email: email.toLowerCase() });
    if (!user) throw new Error(`Kein Nutzer mit der Adresse ${email}`);
    userId = String(user._id);
  }

  const search = await findImportBatch(db, rows, { userId, allowPartial });
  if (!search.ok) {
    console.log(`\nABBRUCH: ${search.reason}`);
    for (const batch of search.batches) printBatch(batch);
    process.exitCode = 2;
  } else {
    const { batch } = search;
    const owner = await db.collection("user").findOne({ $expr: { $eq: [{ $toString: "$_id" }, batch.userId] } });
    console.log(`\nGefunden: Import vom ${batch.createdAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} für ${owner?.email ?? batch.userId}`);
    await nameAccounts(db, batch.userId);
    printBatch(batch);
    if (search.others.length > 0) {
      console.log(`\nHinweis: ${search.others.length} weitere Buchungsgruppen haben einzelne gleiche Zeilen, gehören aber nicht zu diesem Import und bleiben.`);
    }

    if (!apply) {
      console.log(`\nProbelauf: ${batch.docs.length} Buchungen würden gelöscht. Zum Löschen denselben Befehl mit --apply ausführen.`);
      await printDashboard(db, batch.userId, "Dashboard nach dem Löschen (Vorschau)", batch);
    } else {
      const { dir } = await backupDatabase(db, "before-undo-import");
      await writeFile(
        path.join(dir, "geloeschte-importbuchungen.ejson"),
        BSON.EJSON.stringify(batch.docs, undefined, 2, { relaxed: false }),
        "utf8",
      );
      console.log(`\nGesichert: ${dir}`);

      const result = await deleteImportBatch(db, batch);
      if (result.deleted !== result.expected) {
        throw new Error(`Erwartet ${result.expected}, gelöscht ${result.deleted}. Sicherung: ${dir}`);
      }
      console.log(`Gelöscht: ${result.deleted} Buchungen.`);
      await printDashboard(db, batch.userId, "Dashboard jetzt");
    }
  }
} finally {
  await closeScriptDb(client);
}

const accountNames = new Map<string, string>();

async function nameAccounts(db: Db, userId: string) {
  for (const doc of await db.collection("accounts").find({ userId }).toArray()) accountNames.set(doc._id.toString(), String(doc.name));
}

function printBatch(batch: ImportBatch) {
  const accounts = [...new Set(batch.docs.map((doc) => (doc.accountId ? accountNames.get(doc.accountId) ?? doc.accountId : "ohne Konto")))];
  console.log(`  ${batch.docs.length} Buchungen, Konto ${accounts.join(", ")}`);
  if (batch.foreign.length > 0) console.log(`  davon ${batch.foreign.length} NICHT aus dieser Datei`);
  if (batch.missingLines.length > 0) console.log(`  Zeilen der Datei ohne Buchung: ${batch.missingLines.join(", ")}`);
  for (const doc of batch.edited) {
    console.log(`  nach dem Import verändert: ${doc.date} ${doc.title} ${money(doc.amountCents)} (${doc.status ?? "booked"})`);
  }
}

/** Kennzahlen wie auf der Startseite, aus dem (kuenftigen) Datenstand. */
async function printDashboard(db: Db, userId: string, title: string, without?: ImportBatch) {
  const skip = new Set(without?.docs.map((doc) => doc._id.toString()));
  const settings = await db.collection<{ _id: string; timeZone?: string }>("user_settings").findOne({ _id: userId });
  const [accountDocs, transactionDocs, recurringDocs] = await Promise.all([
    db.collection("accounts").find({ userId }).toArray(),
    db.collection("transactions").find({ userId }).toArray(),
    db.collection("recurring").find({ userId }).toArray(),
  ]);
  const accounts = accountDocs.map((doc) => toAccount(doc as never));
  const transactions = transactionDocs.filter((doc) => !skip.has(doc._id.toString())).map((doc) => toTransaction(doc as never));
  const recurring = recurringDocs.map((doc) => toRecurring(doc as never));
  const today = todayIn(settings?.timeZone ?? "Europe/Berlin");
  const d = buildDashboard({ accounts, transactions, recurring, today });
  const a = d.availability;

  const lines: Array<[string, string]> = [
    ["Kontostand (tatsächlich)", money(a.liquidBalance)],
    [`− Fällig, noch nicht bezahlt (${a.dueUnpaid.items.length})`, money(a.dueUnpaid.total)],
    [`− Geplant bis Monatsende (${a.plannedExpenses.items.length})`, money(a.plannedExpenses.total)],
    ["= Aktuell verfügbar", money(a.available)],
    [`+ Erwartete Einnahmen (${a.expectedIncome.items.length})`, money(a.expectedIncome.total)],
    ["= Voraussichtlich am Monatsende", money(a.projectedMonthEnd)],
    [`Einnahmen ${d.month}`, money(d.current.income)],
    [`Ausgaben ${d.month} (fest/variabel)`, `${money(d.current.expense)} (${money(d.current.fixed)} / ${money(d.current.variable)})`],
    [`Einnahmen/Ausgaben ${d.previous.month}`, `${money(d.previous.income)} / ${money(d.previous.expense)}`],
    ["Realistisch sparbar", d.savings ? money(d.savings.amount) : "–"],
    ["Abo-Anteil", d.subscriptionShare === null ? "–" : `${Math.round(d.subscriptionShare * 100)} % (Basis: ${d.shareBase})`],
    ["Buchungen ohne Konto", String(d.unassignedCount)],
  ];
  console.log(`\n${title} (heute ${today}):`);
  for (const [name, value] of lines) console.log(`  ${name.padEnd(42)} ${value}`);

  const unassigned = transactions.filter((tx) => !tx.accountId && tx.status === "booked");
  if (unassigned.length > 0) {
    console.log("\nBuchungen ohne Konto:");
    for (const tx of unassigned) console.log(`  ${tx.date} ${tx.type === "income" ? "+" : "−"}${money(tx.amountCents)} ${tx.title}`);
  }
  const recent = transactions.filter((tx) => tx.status === "booked" && !tx.transferGroupId && tx.date >= `${d.previous.month}-01`);
  if (recent.length > 0) {
    console.log(`\nÜbrige gebuchte Einnahmen/Ausgaben seit ${d.previous.month}-01 (nicht aus dem Import):`);
    for (const tx of recent) {
      console.log(`  ${tx.date} ${tx.type === "income" ? "+" : "−"}${money(tx.amountCents)} ${tx.title}${tx.accountId ? "" : " (ohne Konto)"}${tx.recurringId ? " (regelmäßig)" : ""}`);
    }
  }
}
