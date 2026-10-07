import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";
import { todayIn } from "@/lib/domain/calendar";

/**
 * Kernversprechen der Plattform: Nutzer A sieht und veraendert niemals Daten
 * von Nutzer B - geprueft gegen eine echte MongoDB, ueber alle Lesewege der App.
 */

const A = "user-a";
const B = "user-b";

let env: Awaited<ReturnType<typeof startTestMongo>>;
let mongo: typeof import("@/lib/mongo");
let ledger: typeof import("@/lib/server/ledger");
let finance: typeof import("@/lib/server/finance");
let reports: typeof import("@/lib/server/reports");
let ownership: typeof import("@/lib/server/ownership");
let userData: typeof import("@/lib/server/user-data");

const ids = { accountA: "", categoryA: "", accountB: "" };
const today = todayIn("Europe/Berlin");
const month = today.slice(0, 7);

beforeAll(async () => {
  env = await startTestMongo("isolation");
  mongo = await import("@/lib/mongo");
  ledger = await import("@/lib/server/ledger");
  finance = await import("@/lib/server/finance");
  reports = await import("@/lib/server/reports");
  ownership = await import("@/lib/server/ownership");
  userData = await import("@/lib/server/user-data");
  await mongo.ensureIndexes();

  const now = new Date();
  for (const userId of [A, B]) {
    const factor = userId === A ? 10 : 1;
    const account = await mongo.accounts.insertOne({
      userId, name: `Giro ${userId}`, kind: "giro", startBalanceCents: 100_00 * factor,
      color: "#000000", icon: "", archived: false, createdAt: now,
    });
    const category = await mongo.categories.insertOne({
      userId, name: "Lebensmittel", kind: "expense", color: "#000000",
      icon: "", budgetCents: 200_00, createdAt: now,
    });
    await mongo.transactions.insertOne({
      userId, type: "expense", amountCents: 12_34 * factor, title: `Einkauf ${userId}`,
      note: null, date: today, categoryId: category.insertedId.toString(),
      recurringId: null, accountId: account.insertedId.toString(), createdAt: now,
    });
    await mongo.goals.insertOne({
      userId, title: `Ziel ${userId}`, targetCents: 1000_00, savedCents: 0,
      deadline: null, color: "#000000", note: null, monthlyContributionCents: 50_00, createdAt: now,
    });
    await mongo.recurring.insertOne({
      userId, type: "expense", amountCents: 9_99 * factor, title: `Abo ${userId}`,
      interval: "monthly", categoryId: null, startDate: "2026-01-15",
      nextDue: "2099-01-15", active: true, note: null, createdAt: now,
    });
    await mongo.planned.insertOne({
      userId, kind: "income", title: `Erstattung ${userId}`, amountCents: 5_00, dateFrom: null, dateTo: null,
      certainty: "expected", status: "open", categoryId: null, accountId: null, note: null, transactionId: null, createdAt: now,
    });
    await mongo.scenarios.insertOne({ userId, name: `Szenario ${userId}`, events: [], createdAt: now, updatedAt: now });
    await userData.ensureSettings(userId);

    if (userId === A) {
      ids.accountA = account.insertedId.toString();
      ids.categoryA = category.insertedId.toString();
    } else {
      ids.accountB = account.insertedId.toString();
    }
  }
});

afterAll(async () => {
  await env?.stop();
});

describe("Isolation zwischen Nutzern", () => {
  it("Buchungsliste und Suche zeigen nur eigene Buchungen", async () => {
    const all = await ledger.listTransactions(B, { month: null, query: "", type: null, categoryId: null, accountId: null });
    expect(all.rows.map((t) => t.title)).toEqual(["Einkauf user-b"]);

    // Auch gezielt nach fremden Inhalten, Konten und Kategorien gefiltert
    const search = await ledger.listTransactions(B, { month: null, query: "user-a", type: null, categoryId: null, accountId: null });
    expect(search.rows).toHaveLength(0);
    const byForeignAccount = await ledger.listTransactions(B, { month: null, query: "", type: null, categoryId: null, accountId: ids.accountA });
    expect(byForeignAccount.rows).toHaveLength(0);
    const byForeignCategory = await ledger.listTransactions(B, { month: null, query: "", type: null, categoryId: ids.categoryA, accountId: null });
    expect(byForeignCategory.rows).toHaveLength(0);

    expect(await ledger.exportTransactions(B, null)).toHaveLength(1);
  });

  it("Kontostaende, Prognose und Bericht rechnen nur eigene Daten", async () => {
    const balances = await finance.getAccountBalances(B, today);
    expect(balances.map((a) => [a.id, a.balanceCents])).toEqual([[ids.accountB, 100_00 - 12_34]]);

    const picture = await finance.loadFinancialPicture(B);
    expect(picture.openingBalanceCents).toBe(100_00 - 12_34);
    expect(picture.recurring.map((r) => r.title)).toEqual(["Abo user-b"]);
    expect(picture.goals.map((g) => g.title)).toEqual(["Ziel user-b"]);
    expect(picture.planned.map((p) => p.title)).toEqual(["Erstattung user-b"]);
    expect(picture.monthly.fixedCents).toBe(9_99);

    const report = await reports.getMonthReport(B, month, today);
    expect(report.expenseCents).toBe(12_34);
  });

  it("fremde Referenzen werden abgewiesen", async () => {
    expect(await ownership.ownedRef(B, "accounts", ids.accountA)).toBe(false);
    expect(await ownership.ownedRef(B, "categories", ids.categoryA)).toBe(false);
    expect(await ownership.ownedRef(B, "accounts", ids.accountB)).toBe(ids.accountB);
    expect(await ownership.ownedRef(B, "accounts", "none")).toBeNull();
    expect(await ownership.ownedRef(B, "accounts", "kein-objectid")).toBe(false);

    const refs = await ownership.ownedRefs(B, {
      accountId: { collection: "accounts", raw: ids.accountB },
      categoryId: { collection: "categories", raw: ids.categoryA },
    });
    expect(refs).toEqual({ ok: false, field: "categoryId" });
  });

  it("Export enthaelt nur eigene Daten und keine userId", async () => {
    const data = await userData.exportUserData(B);
    const json = JSON.stringify(data);
    expect(json).not.toContain(A);
    expect(json).not.toContain("userId");
    expect(data.transactions).toHaveLength(1);
    expect(data.scenarios).toHaveLength(1);
  });

  it("Loeschen entfernt nur die Daten des Nutzers", async () => {
    const counts = await userData.deleteUserData(A);
    expect(counts.transactions).toBe(1);
    expect(counts.scenarios).toBe(1);

    for (const name of mongo.USER_DATA_COLLECTIONS) {
      expect(await mongo.db.collection(name).countDocuments({ userId: A })).toBe(0);
    }
    expect(await mongo.settings.countDocuments({ _id: A })).toBe(0);
    expect(await mongo.transactions.countDocuments({ userId: B })).toBe(1);
    expect(await mongo.settings.countDocuments({ _id: B })).toBe(1);
  });
});
