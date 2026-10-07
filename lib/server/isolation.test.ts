import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";

/**
 * Kernversprechen der Plattform: Nutzer A sieht und veraendert niemals Daten
 * von Nutzer B - gepruefts gegen eine echte MongoDB.
 */

const A = "user-a";
const B = "user-b";

let env: Awaited<ReturnType<typeof startTestMongo>>;
let mongo: typeof import("@/lib/mongo");
let queries: typeof import("@/lib/queries");
let ownership: typeof import("@/lib/server/ownership");
let userData: typeof import("@/lib/server/user-data");

const ids = { accountA: "", categoryA: "", accountB: "" };

beforeAll(async () => {
  env = await startTestMongo("isolation");
  mongo = await import("@/lib/mongo");
  queries = await import("@/lib/queries");
  ownership = await import("@/lib/server/ownership");
  userData = await import("@/lib/server/user-data");
  await mongo.ensureIndexes();

  const now = new Date();
  for (const userId of [A, B]) {
    const account = await mongo.accounts.insertOne({
      userId, name: `Giro ${userId}`, kind: "giro", startBalanceCents: 100_00,
      color: "#000000", icon: "", archived: false, createdAt: now,
    });
    const category = await mongo.categories.insertOne({
      userId, name: "Lebensmittel", kind: "expense", color: "#000000",
      icon: "", budgetCents: 200_00, createdAt: now,
    });
    await mongo.transactions.insertOne({
      userId, type: "expense", amountCents: 12_34, title: `Einkauf ${userId}`,
      note: null, date: "2026-10-05", categoryId: category.insertedId.toString(),
      recurringId: null, accountId: account.insertedId.toString(), createdAt: now,
    });
    await mongo.goals.insertOne({
      userId, title: `Ziel ${userId}`, targetCents: 1000_00, savedCents: 0,
      deadline: null, color: "#000000", note: null, createdAt: now,
    });
    await mongo.recurring.insertOne({
      userId, type: "expense", amountCents: 9_99, title: `Abo ${userId}`,
      interval: "monthly", categoryId: null, startDate: "2026-01-15",
      nextDue: "2026-10-15", active: true, note: null, createdAt: now,
    });
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
  it("Lesezugriffe liefern nur eigene Daten", async () => {
    const [tx, accounts, categories, goals, recurring] = await Promise.all([
      queries.getTransactions(B),
      queries.getAccounts(B),
      queries.getCategories(B),
      queries.getGoals(B),
      queries.getRecurring(B),
    ]);

    expect(tx.map((t) => t.title)).toEqual(["Einkauf user-b"]);
    expect(accounts.map((a) => a.id)).toEqual([ids.accountB]);
    expect(categories).toHaveLength(1);
    expect(goals.map((g) => g.title)).toEqual(["Ziel user-b"]);
    expect(recurring.map((r) => r.title)).toEqual(["Abo user-b"]);
  });

  it("Auswertungen rechnen nur eigene Buchungen", async () => {
    const dashboard = await queries.getDashboard(B, "2026-10");
    expect(dashboard.monthTotals.expense).toBe(12_34);
    expect(dashboard.allTime.expense).toBe(12_34);

    const year = await queries.getYearStats(B, 2026);
    expect(year.transactionCount).toBe(1);
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
  });

  it("Loeschen entfernt nur die Daten des Nutzers", async () => {
    const counts = await userData.deleteUserData(A);
    expect(counts.transactions).toBe(1);

    expect(await mongo.transactions.countDocuments({ userId: A })).toBe(0);
    expect(await mongo.settings.countDocuments({ _id: A })).toBe(0);
    expect(await mongo.transactions.countDocuments({ userId: B })).toBe(1);
    expect(await mongo.settings.countDocuments({ _id: B })).toBe(1);
  });
});
