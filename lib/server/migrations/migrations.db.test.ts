import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";

let env: Awaited<ReturnType<typeof startTestMongo>>;

beforeAll(async () => {
  env = await startTestMongo("migrations");
});

afterAll(async () => {
  await env?.stop();
});

describe("Migrationen gegen echte Daten", () => {
  it("verknuepft alte Umbuchungspaare und kopiert Erstattungen", async () => {
    const { db, transactions, planned, settings, recurring } = await import("@/lib/server/db");
    const refunds = db.collection("refunds");
    const { migrations } = await import("./index");
    const { runMigrations } = await import("./runner");

    const createdAt = new Date("2026-09-01T10:00:00Z");
    const base = {
      userId: "u1", amountCents: 50_00, note: "Umbuchung", date: "2026-09-01",
      categoryId: null, recurringId: null, createdAt,
    };
    await transactions.insertMany([
      { ...base, type: "expense", title: "Umbuchung an Sparkonto", accountId: "a1" },
      { ...base, type: "income", title: "Umbuchung von Giro", accountId: "a2" },
      // Gleiche Notiz, aber normale Buchung - darf nicht angefasst werden
      { ...base, type: "expense", title: "Miete", createdAt: new Date() },
    ]);
    await refunds.insertOne({
      userId: "u1", title: "Krankenkasse", amountCents: 80_00, expectedFrom: null,
      expectedTo: null, status: "open", receivedDate: null, categoryId: null,
      accountId: null, note: null, createdAt,
    });
    await db.collection("user").insertOne({ name: "Bestand", email: "b@example.org" });
    await recurring.insertMany([
      {
        userId: "u1", type: "expense", amountCents: 12_99, title: "Netflix", interval: "monthly",
        categoryId: null, startDate: "2026-01-05", nextDue: "2026-11-05", active: true, note: null, createdAt,
      },
      {
        userId: "u1", type: "expense", amountCents: 800_00, title: "Miete", interval: "monthly",
        categoryId: null, startDate: "2026-01-01", nextDue: "2026-11-01", active: false, note: null, createdAt,
      },
    ]);

    const results = await runMigrations(db, migrations, { dryRun: false });
    expect(results.map((r) => r.id)).toEqual([
      "001-user-settings",
      "002-transfer-groups",
      "003-refunds-to-planned",
      "004-recurring-drift",
      "005-planned-to-transactions",
      "006-recurring-status-cost-type",
    ]);

    const pair = await transactions.find({ title: /^Umbuchung/ }).toArray();
    expect(pair[0].transferGroupId).toBeTruthy();
    expect(pair[0].transferGroupId).toBe(pair[1].transferGroupId);
    expect((await transactions.findOne({ title: "Miete" }))?.transferGroupId).toBeUndefined();

    expect(await planned.countDocuments({ userId: "u1", status: "open", kind: "income" })).toBe(1);
    expect(await refunds.countDocuments()).toBe(1); // Original bleibt
    expect((await settings.findOne({}))?.onboardingCompletedAt).toBeInstanceOf(Date);

    // 005: die offene Erstattung (ohne Termin) wird nicht eingeplant - nichts erfinden
    expect(await transactions.countDocuments({ status: "pending" })).toBe(0);

    // 006: Status und Kostenart ergaenzt, altes Feld bleibt
    const netflix = await recurring.findOne({ title: "Netflix" });
    expect(netflix).toMatchObject({ status: "active", costType: "subscription", active: true });
    expect(await recurring.findOne({ title: "Miete" })).toMatchObject({ status: "paused", costType: "rent" });

    // Zweiter Lauf: nichts mehr zu tun
    expect(await runMigrations(db, migrations, { dryRun: false })).toEqual([]);
  });
});
