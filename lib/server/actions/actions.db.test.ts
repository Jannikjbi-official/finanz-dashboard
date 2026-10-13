import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestMongo } from "@/test/mongo";

/**
 * Server Actions gegen eine echte MongoDB: Buchungslogik, Doppelbuchungs-
 * schutz und Trennung zwischen Nutzern.
 */

const session = vi.hoisted(() => ({ userId: "user-a" }));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/server/session", () => ({
  getCurrentUser: async () => ({ id: session.userId, email: `${session.userId}@example.org`, name: session.userId }),
  requireUser: async () => ({ id: session.userId }),
}));

let env: Awaited<ReturnType<typeof startTestMongo>>;
let db: typeof import("@/lib/server/db");
let data: typeof import("@/lib/server/data");
let tx: typeof import("./transactions");
let rec: typeof import("./recurring");
let acc: typeof import("./accounts");
let overview: typeof import("@/lib/domain/overview");

beforeAll(async () => {
  env = await startTestMongo("actions");
  db = await import("@/lib/server/db");
  data = await import("@/lib/server/data");
  tx = await import("./transactions");
  rec = await import("./recurring");
  acc = await import("./accounts");
  overview = await import("@/lib/domain/overview");
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
    db.categories.deleteMany({}),
    db.imports.deleteMany({}),
    db.db.collection("rate_limits").deleteMany({}),
  ]);
});

async function load(userId = "user-a") {
  const loaded = await data.loadFinanceData(userId);
  return { ...loaded, availability: overview.availability(loaded) };
}

async function createAccount(name: string, kind: "giro" | "savings", startBalance: string) {
  expect(await acc.saveAccount({ name, kind, startBalance, liquid: kind !== "savings" })).toMatchObject({ ok: true });
  const doc = await db.accounts.findOne({ name });
  return doc!._id.toString();
}

describe("Server Actions", () => {
  it("funktioniert ohne Daten", async () => {
    const result = await load();
    expect(result.accounts).toEqual([]);
    expect(result.availability.available).toBe(0);
  });

  it("geplante Ausgaben aendern den Kontostand erst nach dem Bezahlen", async () => {
    const giro = await createAccount("Giro", "giro", "1.000,00");
    await tx.saveTransaction({ type: "expense", status: "pending", amount: "49,99", date: "2026-10-01", title: "Rechnung", accountId: giro });

    let result = await load();
    expect(result.availability.liquidBalance).toBe(1000_00);
    expect(result.availability.dueUnpaid.total).toBe(49_99);
    expect(result.availability.available).toBe(1000_00 - 49_99);

    const id = (await db.transactions.findOne({ title: "Rechnung" }))!._id.toString();
    expect(await tx.setTransactionStatus(id, "booked")).toMatchObject({ ok: true });

    result = await load();
    expect(result.availability.liquidBalance).toBe(1000_00 - 49_99);
    expect(result.availability.dueUnpaid.total).toBe(0);
    expect(result.availability.available).toBe(1000_00 - 49_99);
  });

  it("Transfer veraendert beide Konten, aber keine Einnahmen/Ausgaben", async () => {
    const giro = await createAccount("Giro", "giro", "500");
    const spar = await createAccount("Spar", "savings", "0");
    expect(await tx.saveTransfer({ fromAccountId: giro, toAccountId: spar, amount: "200", date: "2026-10-05" })).toMatchObject({ ok: true });
    expect(await tx.saveTransfer({ fromAccountId: giro, toAccountId: giro, amount: "1", date: "2026-10-05" })).toMatchObject({ ok: false });

    const result = await load();
    expect(result.availability.liquidBalance).toBe(300_00);
    expect(result.availability.totalBalance).toBe(500_00);
    const { monthSummary } = await import("@/lib/domain/ledger");
    expect(monthSummary(result.transactions, "2026-10")).toMatchObject({ income: 0, expense: 0 });

    // Loeschen einer Haelfte entfernt den ganzen Transfer
    const half = await db.transactions.findOne({ type: "income" });
    await tx.deleteTransaction(half!._id.toString());
    expect(await db.transactions.countDocuments()).toBe(0);
  });

  it("ein Termin kann nur einmal bezahlt werden, Loeschen oeffnet ihn wieder", async () => {
    const giro = await createAccount("Giro", "giro", "100");
    await rec.saveRecurring({
      type: "expense", title: "Streaming", amount: "12,99", interval: "monthly",
      nextDue: "2026-10-05", costType: "subscription", accountId: giro,
    });
    const id = (await db.recurring.findOne({}))!._id.toString();

    const first = rec.settleRecurring({ id, due: "2026-10-05", mode: "book" });
    const second = rec.settleRecurring({ id, due: "2026-10-05", mode: "book" });
    const results = await Promise.all([first, second]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await db.transactions.countDocuments({ recurringId: id })).toBe(1);
    expect((await db.recurring.findOne({}))!.nextDue).toBe("2026-11-05");

    const paid = await db.transactions.findOne({ recurringId: id });
    expect(paid).toMatchObject({ amountCents: 12_99, status: "booked", recurringDue: "2026-10-05", accountId: giro });

    await tx.deleteTransaction(paid!._id.toString());
    expect((await db.recurring.findOne({}))!.nextDue).toBe("2026-10-05");
  });

  it("Pausieren stoppt Termine, Reaktivieren holt keine verpassten nach", async () => {
    await rec.saveRecurring({
      type: "expense", title: "Gym", amount: "30", interval: "monthly", nextDue: "2020-01-15", costType: "subscription",
    });
    const id = (await db.recurring.findOne({}))!._id.toString();
    await rec.setRecurringStatus({ id, status: "paused" });
    expect((await load()).availability.dueUnpaid.total).toBe(0);

    await rec.setRecurringStatus({ id, status: "active" });
    const doc = await db.recurring.findOne({});
    const { today } = await load();
    expect(doc!.nextDue >= today).toBe(true);
    expect(doc!.nextDue.slice(8)).toBe("15");
  });

  it("gekuendigt ohne Vertragsende plant nichts mehr ein", async () => {
    await rec.saveRecurring({
      type: "expense", title: "Zeitung", amount: "20", interval: "monthly", nextDue: "2026-10-20", costType: "subscription",
    });
    const id = (await db.recurring.findOne({}))!._id.toString();
    await rec.setRecurringStatus({ id, status: "cancelled" });
    const result = await load();
    expect(result.availability.plannedExpenses.total + result.availability.dueUnpaid.total).toBe(0);
  });

  it("validiert serverseitig", async () => {
    const giro = await createAccount("Giro", "giro", "0");
    expect(await tx.saveTransaction({ type: "expense", status: "booked", amount: "-5", date: "2026-10-01", title: "x", accountId: giro })).toMatchObject({ ok: false });
    expect(await tx.saveTransaction({ type: "expense", status: "booked", amount: "5", date: "2026-02-30", title: "x", accountId: giro })).toMatchObject({ ok: false });
    expect(await tx.saveTransaction({ type: "expense", status: "booked", amount: "5", date: "2026-10-01", title: " ", accountId: giro })).toMatchObject({ ok: false });
    expect(await db.transactions.countDocuments()).toBe(0);
  });

  it("Nutzer B kann Daten von Nutzer A weder sehen noch aendern", async () => {
    const giro = await createAccount("Giro A", "giro", "100");
    await tx.saveTransaction({ type: "expense", status: "booked", amount: "10", date: "2026-10-01", title: "A", accountId: giro });
    const id = (await db.transactions.findOne({ title: "A" }))!._id.toString();

    session.userId = "user-b";
    expect((await load("user-b")).transactions).toEqual([]);
    expect(await tx.deleteTransaction(id)).toMatchObject({ ok: false });
    expect(await tx.saveTransaction({ id, type: "expense", status: "booked", amount: "99", date: "2026-10-01", title: "B", accountId: giro })).toMatchObject({ ok: false });
    expect(await tx.saveTransaction({ type: "expense", status: "booked", amount: "1", date: "2026-10-01", title: "B", accountId: giro })).toMatchObject({ ok: false, error: "Konto nicht gefunden" });

    expect(await db.transactions.findOne({ title: "A" })).toMatchObject({ amountCents: 10_00 });
  });
});

describe("Kontostand mit Datum (#16)", () => {
  it("neues Konto mit heutigem Stand: spaeter importierte aeltere Buchungen aendern ihn nicht", async () => {
    const { today } = await load();
    expect(await acc.saveAccount({ name: "Giro", kind: "giro", balance: "883,85", balanceDate: today, liquid: true })).toMatchObject({ ok: true });
    const giro = (await db.accounts.findOne({ name: "Giro" }))!;
    expect(giro.balanceAnchor).toEqual({ date: today, amountCents: 883_85 });

    // Alte Buchung von vor einer Woche nachgetragen: Stand bleibt
    const { addDays } = await import("@/lib/domain/calendar");
    await tx.saveTransaction({ type: "expense", status: "booked", amount: "50", date: addDays(today, -7), title: "Alt", accountId: giro._id.toString() });
    expect((await load()).availability.liquidBalance).toBe(883_85);
  });

  it("Abgleich setzt den Stand, Zukunftsdaten werden abgelehnt", async () => {
    const giro = await createAccount("Giro", "giro", "765,44");
    await tx.saveTransaction({ type: "income", status: "booked", amount: "278,48", date: "2026-09-30", title: "Rente", accountId: giro });
    expect((await load()).availability.liquidBalance).toBe(765_44 + 278_48);

    expect(await acc.setBalanceAnchor({ accountId: giro, balance: "883,85", date: "2026-10-13" })).toMatchObject({ ok: true });
    expect((await load()).availability.liquidBalance).toBe(883_85);
    expect(await acc.setBalanceAnchor({ accountId: giro, balance: "1", date: "2999-01-01" })).toMatchObject({ ok: false });

    session.userId = "user-b";
    expect(await acc.setBalanceAnchor({ accountId: giro, balance: "0", date: "2026-10-13" })).toMatchObject({ ok: false });
  });

  it("Import mit Kontostand laut Bank: Stand, Vormerkung und Verfuegbar stimmen", async () => {
    const giro = await createAccount("Giro", "giro", "765,44");
    const { importTransactions } = await import("./import");
    const result = await importTransactions({
      accountId: giro,
      balance: "883,85",
      balanceDate: "2026-10-13",
      rows: [
        { date: "2026-09-30", title: "Rente", amountCents: 278_48, type: "income", status: "booked", category: null, note: null },
        { date: "2026-10-07", title: "Stadtkasse", amountCents: 1035_54, type: "income", status: "booked", category: null, note: null },
        { date: "2026-10-13", title: "Vorgemerkt", amountCents: 244_21, type: "expense", status: "pending", category: null, note: null },
      ],
    });
    expect(result).toMatchObject({ ok: true, imported: 3 });
    const { availability } = await load();
    expect(availability.liquidBalance).toBe(883_85);
    expect(availability.bankPending.total).toBe(244_21);
    expect(availability.available).toBe(883_85 - 244_21);
  });
});

describe("Regelmaessige Zahlungen mit Buchungen abgleichen (#17)", () => {
  async function setup() {
    const giro = await createAccount("Giro", "giro", "0");
    await rec.saveRecurring({ type: "income", title: "Waisenrente", amount: "276,48", interval: "monthly", nextDue: "2026-09-30", costType: "other", accountId: giro });
    await rec.saveRecurring({ type: "income", title: "Grundsicherung", amount: "563", interval: "monthly", nextDue: "2026-09-30", costType: "other", accountId: giro });
    const waisen = (await db.recurring.findOne({ title: "Waisenrente" }))!._id.toString();
    const grund = (await db.recurring.findOne({ title: "Grundsicherung" }))!._id.toString();
    return { giro, waisen, grund };
  }
  const row = (date: string, title: string, amountCents: number) => ({ date, title, amountCents, type: "income" as const, status: "booked" as const, category: null, note: null });

  it("ordnet beim Import passende Zahlungen zu, Rueckgaengig oeffnet den Termin wieder", async () => {
    const { giro, waisen } = await setup();
    const { importTransactions, undoImport } = await import("./import");
    const result = await importTransactions({
      accountId: giro,
      rows: [row("2026-09-30", "Renten Service", 278_48), row("2026-10-07", "Stadt Oldenburg, Abrechnung 10/2026", 1035_54)],
    });
    expect(result).toMatchObject({ ok: true, message: expect.stringContaining("1 regelmäßige Zahlungen zugeordnet") });
    expect((await db.recurring.findOne({ title: "Waisenrente" }))!.nextDue).toBe("2026-10-30");
    expect(await db.transactions.findOne({ title: "Renten Service" })).toMatchObject({ recurringId: waisen, recurringDue: "2026-09-30" });
    // Grundsicherung: anderer Name, ganz anderer Betrag - bleibt offen
    expect((await db.recurring.findOne({ title: "Grundsicherung" }))!.nextDue).toBe("2026-09-30");
    const { availability } = await load();
    expect(availability.overdueIncome.items.map((item) => item.title)).toEqual(["Grundsicherung"]);

    const record = await db.imports.findOne({});
    expect(await undoImport(record!._id)).toMatchObject({ ok: true });
    expect((await db.recurring.findOne({ title: "Waisenrente" }))!.nextDue).toBe("2026-09-30");
  });

  it("verknuepft von Hand, lehnt ab und loest wieder", async () => {
    const { giro, grund } = await setup();
    await tx.saveTransaction({ type: "income", status: "booked", amount: "1.035,54", date: "2026-10-07", title: "Stadt Oldenburg", accountId: giro });
    const stadt = (await db.transactions.findOne({ title: "Stadt Oldenburg" }))!._id.toString();
    const match = await import("./matching");

    const candidates = await match.findLinkCandidates(grund, "2026-09-30");
    expect(candidates.map((c) => c.id)).toContain(stadt);
    expect(await match.linkRecurringPayment({ recurringId: grund, due: "2026-09-30", transactionId: stadt })).toMatchObject({ ok: true });
    expect((await db.recurring.findOne({ title: "Grundsicherung" }))!.nextDue).toBe("2026-10-30");
    // Zweimal geht nicht
    expect(await match.linkRecurringPayment({ recurringId: grund, due: "2026-09-30", transactionId: stadt })).toMatchObject({ ok: false });

    expect(await match.unlinkRecurringPayment(stadt)).toMatchObject({ ok: true });
    expect((await db.recurring.findOne({ title: "Grundsicherung" }))!.nextDue).toBe("2026-09-30");
    expect(await db.transactions.findOne({ title: "Stadt Oldenburg" })).toMatchObject({ recurringId: null, dismissedRecurring: [grund] });

    expect(await match.dismissRecurringMatch({ recurringId: grund, transactionId: stadt })).toMatchObject({ ok: true });
  });

  it("fremde Nutzer koennen nichts zuordnen", async () => {
    const { giro, waisen } = await setup();
    await tx.saveTransaction({ type: "income", status: "booked", amount: "276,48", date: "2026-09-30", title: "Waisenrente", accountId: giro });
    const id = (await db.transactions.findOne({}))!._id.toString();
    session.userId = "user-b";
    const match = await import("./matching");
    expect(await match.linkRecurringPayment({ recurringId: waisen, due: "2026-09-30", transactionId: id })).toMatchObject({ ok: false });
    expect(await match.findLinkCandidates(waisen, "2026-09-30")).toEqual([]);
    expect((await db.recurring.findOne({ title: "Waisenrente" }))!.nextDue).toBe("2026-09-30");
  });
});
