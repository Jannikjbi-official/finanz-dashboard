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
  await Promise.all([db.accounts.deleteMany({}), db.transactions.deleteMany({}), db.recurring.deleteMany({}), db.categories.deleteMany({})]);
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
