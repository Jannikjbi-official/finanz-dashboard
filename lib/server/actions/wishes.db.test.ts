import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestMongo } from "@/test/mongo";

/**
 * Wunschliste gegen eine echte MongoDB: Wuensche aendern keine Zahl, erst
 * eingeplant zaehlen sie in "Aktuell verfuegbar". Import und Rueckgaengig.
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
let actions: typeof import("./wishes");
let imports: typeof import("./import");
let overview: typeof import("@/lib/domain/overview");

beforeAll(async () => {
  env = await startTestMongo("wishes");
  db = await import("@/lib/server/db");
  data = await import("@/lib/server/data");
  actions = await import("./wishes");
  imports = await import("./import");
  overview = await import("@/lib/domain/overview");
});

afterAll(async () => {
  await env?.stop();
});

let giro: string;

beforeEach(async () => {
  session.userId = "user-a";
  await Promise.all([
    db.accounts.deleteMany({}),
    db.transactions.deleteMany({}),
    db.wishes.deleteMany({}),
    db.imports.deleteMany({}),
    db.db.collection("rate_limits").deleteMany({}),
  ]);
  const { insertedId } = await db.accounts.insertOne({ userId: "user-a", name: "Giro", kind: "giro", startBalanceCents: 500_00, archived: false, createdAt: new Date() });
  giro = insertedId.toString();
});

async function available() {
  const loaded = await data.loadFinanceData("user-a");
  return overview.availability(loaded);
}

async function addWish(title = "Kopfhörer", amount = "89,90") {
  expect(await actions.saveWish({ title, amount, priority: "normal", targetDate: null })).toMatchObject({ ok: true });
  return (await db.wishes.findOne({ title }))!._id.toString();
}

describe("Wunschliste", () => {
  it("ein Wunsch aendert keine Zahl, eingeplant zaehlt er", async () => {
    const id = await addWish();
    expect((await available()).available).toBe(500_00);

    const { today } = await data.loadFinanceData("user-a");
    expect(await actions.planWish({ id, date: today, accountId: giro, amount: "89,90" })).toMatchObject({ ok: true });
    const result = await available();
    expect(result.dueUnpaid.total + result.plannedExpenses.total).toBe(89_90);
    expect(result.available).toBe(500_00 - 89_90);
    expect(await db.transactions.countDocuments({ wishId: id, status: "pending" })).toBe(1);

    // Zweites Einplanen verschiebt nur, legt nichts doppelt an
    expect(await actions.planWish({ id, date: today, accountId: giro, amount: "79,90" })).toMatchObject({ ok: true });
    expect(await db.transactions.countDocuments({ wishId: id })).toBe(1);
    expect((await available()).available).toBe(500_00 - 79_90);

    expect(await actions.unplanWish(id)).toMatchObject({ ok: true });
    expect(await db.transactions.countDocuments({ wishId: id })).toBe(0);
    expect((await available()).available).toBe(500_00);
  });

  it("gekauft bucht die geplante Zahlung oder markiert nur", async () => {
    const id = await addWish();
    const { today } = await data.loadFinanceData("user-a");
    await actions.planWish({ id, date: today, accountId: giro, amount: "89,90" });

    expect(await actions.markWishBought({ id, book: true, amount: "85,00", date: today, accountId: null })).toMatchObject({ ok: true });
    const paid = await db.transactions.findOne({ wishId: id });
    expect(paid).toMatchObject({ status: "booked", amountCents: 85_00, accountId: giro });
    expect((await available()).liquidBalance).toBe(500_00 - 85_00);
    expect(await db.wishes.findOne({ _id: new db.ObjectId(id) })).toMatchObject({ status: "bought", transactionId: paid!._id.toString() });

    // Kommt die Ausgabe per Kontoimport: nur markieren, geplante Zahlung verschwindet
    const other = await addWish("Kabel", "12,50");
    await actions.planWish({ id: other, date: today, accountId: giro, amount: "12,50" });
    expect(await actions.markWishBought({ id: other, book: false, amount: "12,50", date: today, accountId: null })).toMatchObject({ ok: true });
    expect(await db.transactions.countDocuments({ wishId: other })).toBe(0);
    expect((await available()).liquidBalance).toBe(500_00 - 85_00);
  });

  it("verwerfen und loeschen entfernen nur offene geplante Zahlungen", async () => {
    const id = await addWish();
    const { today } = await data.loadFinanceData("user-a");
    await actions.planWish({ id, date: today, accountId: giro, amount: "89,90" });
    expect(await actions.setWishStatus(id, "dropped")).toMatchObject({ ok: true });
    expect(await db.transactions.countDocuments()).toBe(0);

    const bought = await addWish("Maus", "30");
    await actions.markWishBought({ id: bought, book: true, amount: "30", date: today, accountId: giro });
    expect(await actions.deleteWish(bought)).toMatchObject({ ok: true });
    // Gebuchte Ausgabe bleibt
    expect(await db.transactions.countDocuments({ status: "booked" })).toBe(1);
  });

  it("andere Nutzer koennen Wuensche weder planen noch loeschen", async () => {
    const id = await addWish();
    session.userId = "user-b";
    expect(await actions.planWish({ id, date: "2026-10-20", accountId: giro, amount: "1" })).toMatchObject({ ok: false });
    expect(await actions.deleteWish(id)).toMatchObject({ ok: false });
    expect(await db.wishes.countDocuments()).toBe(1);
  });

  it("importiert Wuensche ohne Dubletten, plant auf Wunsch ein und macht alles rueckgaengig", async () => {
    await addWish("Mikrofon", "398");
    const rows = [
      { title: "Mikrofon", amountCents: 398_00, targetDate: "2026-11-27", priority: "normal" as const, group: "Setup", link: null, note: null, category: null },
      { title: "Mikrofonarm", amountCents: 73_00, targetDate: "2026-11-27", priority: "normal" as const, group: "Setup", link: null, note: null, category: null },
      { title: "Smartwatch", amountCents: 319_99, targetDate: null, priority: "low" as const, group: null, link: "https://example.org/w", note: "Zeitpunkt offen", category: null },
    ];
    const result = await actions.importWishes({ fileName: "wuensche.csv", rows, planDated: true, accountId: giro });
    expect(result).toMatchObject({ ok: true, imported: 2, skipped: 1 });

    const record = await db.imports.findOne({ kind: "wishes" });
    expect(record).toMatchObject({ rowCount: 2, dateFrom: "2026-11-27", dateTo: "2026-11-27" });
    expect(await db.wishes.countDocuments({ importId: record!._id })).toBe(2);
    // Nur der Wunsch mit Termin wurde eingeplant
    expect(await db.transactions.countDocuments({ status: "pending" })).toBe(1);
    expect(await db.wishes.findOne({ title: "Mikrofonarm" })).toMatchObject({ status: "planned" });

    expect(await imports.undoImport(record!._id)).toMatchObject({ ok: true });
    expect(await db.wishes.countDocuments()).toBe(1);
    expect(await db.transactions.countDocuments()).toBe(0);
  });
});
