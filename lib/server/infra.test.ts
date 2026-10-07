import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";
import type { Migration } from "./migrations/runner";

let env: Awaited<ReturnType<typeof startTestMongo>>;

beforeAll(async () => {
  env = await startTestMongo("infra");
});

afterAll(async () => {
  await env?.stop();
});

describe("Rate Limit", () => {
  it("sperrt nach dem Limit und zaehlt pro Schluessel", async () => {
    const { hitRateLimit } = await import("./rate-limit");

    expect((await hitRateLimit("t:1", 2, 60)).allowed).toBe(true);
    expect((await hitRateLimit("t:1", 2, 60)).allowed).toBe(true);
    const third = await hitRateLimit("t:1", 2, 60);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);

    expect((await hitRateLimit("t:2", 2, 60)).allowed).toBe(true);
  });
});

describe("Migrationen", () => {
  it("laufen genau einmal, Probelauf schreibt nichts", async () => {
    const { db } = await import("@/lib/mongo");
    const { runMigrations } = await import("./migrations/runner");

    let calls = 0;
    const list: Migration[] = [
      {
        id: "900-test",
        description: "Test",
        up: async (database, { dryRun }) => {
          calls += 1;
          if (!dryRun) await database.collection("probe").insertOne({ ok: true });
          return dryRun ? "würde 1 schreiben" : "1 geschrieben";
        },
      },
    ];

    let backups = 0;
    const beforeApply = async () => void (backups += 1);

    await runMigrations(db, list, { dryRun: true, beforeApply });
    expect(await db.collection("probe").countDocuments()).toBe(0);
    expect(backups).toBe(0);

    await runMigrations(db, list, { dryRun: false, beforeApply });
    await runMigrations(db, list, { dryRun: false, beforeApply });

    expect(calls).toBe(2);
    expect(backups).toBe(1);
    expect(await db.collection("probe").countDocuments()).toBe(1);
  });
});

describe("Beta-Freischaltung", () => {
  it("laesst nur eingeladene Adressen zu", async () => {
    process.env.ALLOWED_EMAILS = "chef@example.org";
    const { mayRegister, betaInvites } = await import("./beta");

    expect(await mayRegister("Chef@Example.org")).toBe(true);
    expect(await mayRegister("fremd@example.org")).toBe(false);

    await betaInvites.insertOne({ _id: "gast@example.org", invitedAt: new Date(), note: null });
    expect(await mayRegister("gast@example.org")).toBe(true);

    process.env.BETA_OPEN = "true";
    expect(await mayRegister("fremd@example.org")).toBe(true);
    delete process.env.BETA_OPEN;
  });
});
