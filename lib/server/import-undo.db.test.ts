import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { guessMapping, mapRows, parseTable, type ImportRow } from "@/lib/import";
import { startTestMongo } from "@/test/mongo";

/**
 * CSV-Importe wiederfinden und rueckgaengig machen: alte Importe ohne ID
 * (ueber die Datei) und neue mit Import-ID. Geloescht werden darf nur, was
 * aus genau diesem Import stammt.
 */

const session = vi.hoisted(() => ({ userId: "user-a" }));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/server/session", () => ({
  getCurrentUser: async () => ({ id: session.userId, email: `${session.userId}@example.org`, name: session.userId }),
  requireUser: async () => ({ id: session.userId }),
}));

// Gleicher Aufbau wie ein Export aus der Banking-App, aber erfundene Werte
const CSV = [
  "﻿Datum;Status;Typ;Kategorie;Beschreibung;Betrag (EUR);Konto;Notiz",
  "30.09.2026;Gebucht;Einnahme;Einkommen;Rentenkasse;250,00;Giro;",
  "01.10.2026;Gebucht;Ausgabe;Lebensmittel;Supermarkt;-12,40;Giro;",
  "01.10.2026;Gebucht;Ausgabe;Lebensmittel;Bäckerei;-3,50;Giro;",
  "01.10.2026;Gebucht;Ausgabe;Lebensmittel;Bäckerei;-3,50;Giro;",
  "02.10.2026;Gebucht;Umbuchung;Games;Aufladung Revolut;-20,00;Giro;",
  "07.10.2026;Gebucht;Einnahme;Einkommen;Stadtkasse, Abrechnung 10/2026;1.035,54;Giro;",
  "13.10.2026;Vorgemerkt;Ausgabe;Sonstiges;Vorgemerkte Umsätze;-44,21;Giro;noch nicht sichtbar",
  "27.11.2026;Geplant;Ausgabe;Technik;Mikrofon;-398,00;Giro;Sparziel",
].join("\r\n");

function rowsOf(csv: string): ImportRow[] {
  const table = parseTable(csv);
  return mapRows(table, guessMapping(table.header));
}

let env: Awaited<ReturnType<typeof startTestMongo>>;
let db: typeof import("@/lib/server/db");
let data: typeof import("@/lib/server/data");
let actions: typeof import("./actions/import");
let undo: typeof import("./import-undo");

beforeAll(async () => {
  env = await startTestMongo("import-undo");
  db = await import("@/lib/server/db");
  data = await import("@/lib/server/data");
  actions = await import("./actions/import");
  undo = await import("./import-undo");
});

afterAll(async () => {
  await env?.stop();
});

beforeEach(async () => {
  session.userId = "user-a";
  await Promise.all([
    db.accounts.deleteMany({}),
    db.transactions.deleteMany({}),
    db.recurring.deleteMany({}),
    db.imports.deleteMany({}),
    db.categories.deleteMany({}),
    db.db.collection("rate_limits").deleteMany({}),
  ]);
});

async function giro(userId = "user-a") {
  const { insertedId } = await db.accounts.insertOne({ userId, name: "Giro", kind: "giro", startBalanceCents: 765_44, archived: false, createdAt: new Date() });
  return insertedId.toString();
}

/** Import wie bisher (vor der Import-ID): gleicher Aufbau wie importTransactions damals. */
async function legacyImport(userId: string, accountId: string, rows: ImportRow[], createdAt = new Date()) {
  const { duplicateKey } = await import("@/lib/import");
  await db.transactions.insertMany(
    rows.map((row) => ({
      userId,
      type: row.type,
      status: "booked" as const,
      amountCents: row.amountCents,
      date: row.date!,
      title: row.title,
      note: row.note,
      categoryId: null,
      accountId,
      transferGroupId: null,
      recurringId: null,
      recurringDue: null,
      importHash: duplicateKey(row.date!, row.type, row.amountCents, row.title),
      createdAt,
    })),
  );
}

/** Selbst angelegte Daten, die beim Loeschen erhalten bleiben muessen. */
async function ownData(userId: string, accountId: string) {
  const now = new Date(Date.now() - 86_400_000);
  await db.recurring.insertOne({
    userId, type: "income", title: "Rente", amountCents: 250_00, interval: "monthly", categoryId: null,
    startDate: "2026-09-30", nextDue: "2026-09-30", active: true, status: "active", accountId, note: null, createdAt: now,
  });
  await db.transactions.insertMany([
    // Gleiche Werte wie eine Importzeile, aber von Hand erfasst
    { userId, type: "expense", status: "booked", amountCents: 12_40, date: "2026-10-01", title: "Supermarkt", note: null, categoryId: null, accountId, transferGroupId: null, recurringId: null, recurringDue: null, createdAt: now },
    { userId, type: "expense", status: "pending", amountCents: 10_00, date: "2026-10-20", title: "Geplante Zahlung", note: null, categoryId: null, accountId, transferGroupId: null, recurringId: null, recurringDue: null, createdAt: now },
    { userId, type: "income", status: "booked", amountCents: 5_00, date: "2026-09-12", title: "Alte Buchung ohne Konto", note: null, categoryId: null, accountId: null, transferGroupId: null, recurringId: null, recurringDue: null, createdAt: now },
  ]);
}

describe("Alten Import ueber die Datei finden", () => {
  it("findet genau den Importvorgang und loescht nur ihn", async () => {
    const accountId = await giro();
    await ownData("user-a", accountId);
    const rows = rowsOf(CSV);
    await legacyImport("user-a", accountId, rows);
    // Ein anderer Import mit einer gleichen Zeile bleibt
    await legacyImport("user-a", accountId, rows.slice(1, 2), new Date(Date.now() - 3_600_000));

    const before = await db.transactions.countDocuments();
    const search = await undo.findImportBatch(db.db, rows);
    expect(search.ok).toBe(true);
    if (!search.ok) return;
    expect(search.batch.docs).toHaveLength(rows.length);
    expect(search.batch.missingLines).toEqual([]);
    expect(search.others).toHaveLength(1);

    const result = await undo.deleteImportBatch(db.db, search.batch);
    expect(result).toEqual({ expected: 8, deleted: 8 });
    expect(await db.transactions.countDocuments()).toBe(before - 8);
    expect(await db.transactions.countDocuments({ importHash: { $exists: false } })).toBe(3);
    expect(await db.recurring.countDocuments()).toBe(1);
    expect(await db.accounts.countDocuments()).toBe(1);
  });

  it("loescht nichts, wenn die Datei zweimal importiert wurde", async () => {
    const accountId = await giro();
    const rows = rowsOf(CSV);
    await legacyImport("user-a", accountId, rows, new Date(Date.now() - 60_000));
    await legacyImport("user-a", accountId, rows);
    const search = await undo.findImportBatch(db.db, rows);
    expect(search.ok).toBe(false);
  });

  it("verlangt bei abgewaehlten Zeilen eine ausdrueckliche Freigabe", async () => {
    const accountId = await giro();
    const rows = rowsOf(CSV);
    await legacyImport("user-a", accountId, rows.filter((row) => row.line !== 3));
    const strict = await undo.findImportBatch(db.db, rows);
    expect(strict).toMatchObject({ ok: false });
    if (!strict.ok) expect(strict.reason).toContain("Zeilen 3");
    const partial = await undo.findImportBatch(db.db, rows, { allowPartial: true });
    expect(partial.ok && partial.batch.docs.length).toBe(rows.length - 1);
  });

  it("loescht nichts, wenn der Stapel fremde Buchungen enthaelt", async () => {
    const accountId = await giro();
    const rows = rowsOf(CSV);
    const other = rowsOf(CSV.replace("Supermarkt;-12,40", "Drogerie;-7,10"));
    const createdAt = new Date();
    await legacyImport("user-a", accountId, other, createdAt);
    const search = await undo.findImportBatch(db.db, rows);
    expect(search.ok).toBe(false);
  });

  it("unterscheidet Nutzer", async () => {
    const rows = rowsOf(CSV);
    await legacyImport("user-a", await giro("user-a"), rows);
    await legacyImport("user-b", await giro("user-b"), rows);
    expect((await undo.findImportBatch(db.db, rows)).ok).toBe(false);
    const own = await undo.findImportBatch(db.db, rows, { userId: "user-b" });
    expect(own.ok && own.batch.userId).toBe("user-b");
  });
});

describe("Neue Importe mit Import-ID", () => {
  it("markiert jede Buchung und macht den Import vollstaendig rueckgaengig", async () => {
    const accountId = await giro();
    await ownData("user-a", accountId);
    const rows = rowsOf(CSV);
    const result = await actions.importTransactions({
      accountId,
      fileName: "umsaetze.csv",
      rows: rows.map((row) => ({ date: row.date!, title: row.title, amountCents: row.amountCents, type: row.type, category: row.category, note: row.note })),
    });
    expect(result).toMatchObject({ ok: true, imported: 8 });

    const record = await db.imports.findOne({ userId: "user-a" });
    expect(record).toMatchObject({ kind: "transactions", fileName: "umsaetze.csv", rowCount: 8, dateFrom: "2026-09-30", dateTo: "2026-11-27", undoneAt: null });
    expect(await db.transactions.countDocuments({ importId: record!._id })).toBe(8);

    // Nach dem Import bearbeitet - gehoert trotzdem dazu
    await db.transactions.updateOne({ importId: record!._id, title: "Mikrofon" }, { $set: { status: "pending", updatedAt: new Date() } });

    expect(await actions.undoImport(record!._id)).toMatchObject({ ok: true });
    expect(await db.transactions.countDocuments({ importId: record!._id })).toBe(0);
    expect(await db.transactions.countDocuments()).toBe(3);
    expect(await db.imports.findOne({ _id: record!._id })).toMatchObject({ undoneCount: 8 });
    expect(await actions.undoImport(record!._id)).toMatchObject({ ok: false });
  });

  it("andere Nutzer koennen einen Import nicht rueckgaengig machen", async () => {
    const accountId = await giro();
    const rows = rowsOf(CSV).slice(0, 2);
    await actions.importTransactions({
      accountId,
      rows: rows.map((row) => ({ date: row.date!, title: row.title, amountCents: row.amountCents, type: row.type, category: null, note: null })),
    });
    const record = await db.imports.findOne({});
    session.userId = "user-b";
    expect(await actions.undoImport(record!._id)).toMatchObject({ ok: false });
    expect(await db.transactions.countDocuments({ importId: record!._id })).toBe(2);
  });
});

describe("Alte Importe in der Oberflaeche", () => {
  it("zeigt einen Import ohne ID in der Liste und loescht per Knopf nur ihn", async () => {
    const accountId = await giro();
    await ownData("user-a", accountId);
    const rows = rowsOf(CSV);
    const createdAt = new Date("2026-10-13T20:15:00.000Z");
    await legacyImport("user-a", accountId, rows, createdAt);
    await legacyImport("user-a", accountId, rows.slice(0, 2), new Date("2026-10-01T08:00:00.000Z"));

    const list = await data.loadImports("user-a", "transactions");
    expect(list.map((entry) => [entry.id, entry.rowCount, entry.dateFrom, entry.dateTo, entry.legacy])).toEqual([
      ["legacy:2026-10-13T20:15:00.000Z", 8, "2026-09-30", "2026-11-27", true],
      ["legacy:2026-10-01T08:00:00.000Z", 2, "2026-09-30", "2026-10-01", true],
    ]);

    // Andere Nutzer finden ihn nicht
    session.userId = "user-b";
    expect(await actions.undoImport(list[0].id)).toMatchObject({ ok: false });
    session.userId = "user-a";

    expect(await actions.undoImport(list[0].id)).toMatchObject({ ok: true, message: "Import rückgängig gemacht: 8 Buchungen gelöscht" });
    expect(await db.transactions.countDocuments({ createdAt })).toBe(0);
    // Eigene Daten und der andere Import bleiben
    expect(await db.transactions.countDocuments()).toBe(3 + 2);
    expect(await db.recurring.countDocuments()).toBe(1);
    expect(await actions.undoImport(list[0].id)).toMatchObject({ ok: false });

    const after = await data.loadImports("user-a", "transactions");
    expect(after[0]).toMatchObject({ rowCount: 8, undoneCount: 8 });
    expect(after[0].legacy).toBeUndefined();
    expect(after[0].undoneAt).not.toBeNull();
    expect(after[1]).toMatchObject({ id: "legacy:2026-10-01T08:00:00.000Z", legacy: true });
  });

  it("lehnt ungueltige Kennungen ab", async () => {
    expect(await actions.undoImport("legacy:kein-datum")).toMatchObject({ ok: false });
    expect(await actions.undoImport("legacy:2026-10-13")).toMatchObject({ ok: false });
  });
});

describe("Kontoimport mit Status und Umbuchungen (#15)", () => {
  async function importCsv(csv: string, accountId: string, options: { counterAccountId?: string | null; today?: string } = {}) {
    const table = parseTable(csv);
    const rows = mapRows(table, guessMapping(table.header), options.today ?? "2026-10-13");
    return actions.importTransactions({
      accountId,
      fileName: "export.csv",
      counterAccountId: options.counterAccountId ?? null,
      createCategories: true,
      rows: rows
        .filter((row) => row.status !== "planned")
        .map((row) => ({
          date: row.date!, title: row.title, amountCents: row.amountCents, type: row.type,
          status: row.status, transfer: row.transfer, accountId: null, category: row.category, note: row.note,
        })),
    });
  }

  it("bucht nur Gebuchtes, Vormerkungen sind offen, Umbuchungen sind Transfers", async () => {
    const giroId = await giro();
    const { insertedId } = await db.accounts.insertOne({ userId: "user-a", name: "Revolut", kind: "other", startBalanceCents: 0, archived: false, createdAt: new Date() });
    const revolut = insertedId.toString();

    expect(await importCsv(CSV, giroId, { counterAccountId: revolut })).toMatchObject({ ok: true, imported: 7 });
    const { loadFinanceData } = data;
    const loaded = await loadFinanceData("user-a");
    const { availability } = await import("@/lib/domain/overview");
    const { monthSummary } = await import("@/lib/domain/ledger");
    const a = availability({ ...loaded, today: "2026-10-13" });

    // Giro: 765,44 + 250 - 12,40 - 3,50 - 3,50 - 20 (Umbuchung) + 1.035,54
    expect(a.totalBalance).toBe(765_44 + 250_00 - 12_40 - 3_50 - 3_50 - 20_00 + 1035_54 + 20_00);
    expect(a.bankPending.total).toBe(44_21);
    // Oktober: Umbuchung zaehlt weder als Einnahme noch als Ausgabe
    expect(monthSummary(loaded.transactions, "2026-10")).toMatchObject({ income: 1035_54, expense: 12_40 + 3_50 + 3_50 });
    expect(await db.transactions.countDocuments({ accountId: revolut, type: "income", transferGroupId: { $type: "string" } })).toBe(1);
    // Kategorien aus der Datei wurden angelegt
    expect(await db.categories.countDocuments({ userId: "user-a", name: "Lebensmittel", kind: "expense" })).toBe(1);
  });

  it("ueberspringt schon importierte Zeilen auch auf dem Server und ersetzt alte Vormerkungen", async () => {
    const giroId = await giro();
    expect(await importCsv(CSV, giroId)).toMatchObject({ ok: true, imported: 7, skipped: 0 });

    // Neuer Export: Vormerkung ist inzwischen gebucht, eine neue ist dazugekommen
    const next = CSV.replace("13.10.2026;Vorgemerkt;Ausgabe;Sonstiges;Vorgemerkte Umsätze;-44,21", "13.10.2026;Gebucht;Ausgabe;Sonstiges;Kartenzahlung;-44,21")
      + "\r\n14.10.2026;Vorgemerkt;Ausgabe;Sonstiges;Neue Vormerkung;-5,00;Giro;";
    const result = await importCsv(next, giroId, { today: "2026-10-14" });
    expect(result).toMatchObject({ ok: true, imported: 2, skipped: 6 });
    expect(await db.transactions.countDocuments({ bankPending: true })).toBe(1);
    expect(await db.transactions.countDocuments({ title: "Vorgemerkte Umsätze" })).toBe(0);
    expect(await db.transactions.countDocuments({ title: "Kartenzahlung", status: "booked" })).toBe(1);
  });
});
