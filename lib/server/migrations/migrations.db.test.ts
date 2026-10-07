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
    const { db, transactions, refunds, planned, settings } = await import("@/lib/mongo");
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

    const results = await runMigrations(db, migrations, { dryRun: false });
    expect(results.map((r) => r.id)).toEqual([
      "001-user-settings",
      "002-transfer-groups",
      "003-refunds-to-planned",
      "004-recurring-drift",
    ]);

    const pair = await transactions.find({ title: /^Umbuchung/ }).toArray();
    expect(pair[0].transferGroupId).toBeTruthy();
    expect(pair[0].transferGroupId).toBe(pair[1].transferGroupId);
    expect((await transactions.findOne({ title: "Miete" }))?.transferGroupId).toBeUndefined();

    expect(await planned.countDocuments({ userId: "u1", status: "open", kind: "income" })).toBe(1);
    expect(await refunds.countDocuments()).toBe(1); // Original bleibt
    expect((await settings.findOne({}))?.onboardingCompletedAt).toBeInstanceOf(Date);

    // Zweiter Lauf: nichts mehr zu tun
    expect(await runMigrations(db, migrations, { dryRun: false })).toEqual([]);
  });
});
