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
    db.rules.deleteMany({}),
    db.importTrash.deleteMany({}),
    db.wishes.deleteMany({}),
    db.templates.deleteMany({}),
    db.receipts.deleteMany({}),
    db.db.collection("user_snapshots").deleteMany({}),
    db.settings.deleteMany({}),
    db.db.collection("notifications").deleteMany({}),
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

  it("bestaetigte Vormerkung ist eine normale Buchung und wird nicht doppelt importiert", async () => {
    const giro = await createAccount("Giro", "giro", "100");
    const { importTransactions } = await import("./import");
    const row = { date: "2026-10-14", title: "Kartenzahlung", amountCents: 5_00, type: "expense" as const, category: null, note: null };
    expect(await importTransactions({ accountId: giro, rows: [{ ...row, status: "pending" }] })).toMatchObject({ ok: true, imported: 1 });
    const pending = await db.transactions.findOne({ title: "Kartenzahlung" });
    expect(await tx.setTransactionStatus(pending!._id.toString(), "booked")).toMatchObject({ ok: true });
    expect(await db.transactions.findOne({ _id: pending!._id })).toMatchObject({ status: "booked", bankPending: false });

    expect(await importTransactions({ accountId: giro, rows: [{ ...row, status: "booked" }] })).toMatchObject({ ok: true, imported: 0, skipped: 1 });
    const { availability } = await load();
    expect(availability.liquidBalance).toBe(95_00);
    expect(availability.bankPending.total).toBe(0);
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

describe("Kategorisierungsregeln (#22)", () => {
  async function food() {
    expect(await acc.saveCategory({ name: "Lebensmittel", kind: "expense", color: "#a39462" })).toMatchObject({ ok: true });
    return (await db.categories.findOne({ name: "Lebensmittel" }))!._id.toString();
  }

  it("ordnet neue Buchungen und Importe zu, vorhandene auf Knopfdruck", async () => {
    const giro = await createAccount("Giro", "giro", "0");
    const categoryId = await food();
    await tx.saveTransaction({ type: "expense", status: "booked", amount: "9", date: "2026-10-01", title: "LIDL alt", accountId: giro });
    const rules = await import("./rules");
    expect(await rules.saveRule({ match: "lidl", categoryId, kind: "expense" })).toMatchObject({ ok: true });

    await tx.saveTransaction({ type: "expense", status: "booked", amount: "12,50", date: "2026-10-02", title: "Lidl Wilhelmshavener", accountId: giro });
    expect(await db.transactions.findOne({ title: "Lidl Wilhelmshavener" })).toMatchObject({ categoryId });

    const { importTransactions } = await import("./import");
    await importTransactions({ accountId: giro, rows: [{ date: "2026-10-03", title: "Lidl Filiale", amountCents: 5_00, type: "expense", category: null, note: null }] });
    expect(await db.transactions.findOne({ title: "Lidl Filiale" })).toMatchObject({ categoryId });

    expect(await rules.countRuleMatches()).toBe(1);
    expect(await rules.applyRulesToExisting()).toMatchObject({ ok: true });
    expect(await db.transactions.findOne({ title: "LIDL alt" })).toMatchObject({ categoryId });
  });

  it("legt aus einer Buchung eine Regel an; fremde Kategorien sind tabu", async () => {
    const giro = await createAccount("Giro", "giro", "0");
    const categoryId = await food();
    await tx.saveTransaction({ type: "expense", status: "booked", amount: "3", date: "2026-10-01", title: "Bäcker", categoryId, accountId: giro });
    await tx.saveTransaction({ type: "expense", status: "booked", amount: "4", date: "2026-10-02", title: "Bäcker", accountId: giro });
    const rules = await import("./rules");
    const id = (await db.transactions.findOne({ categoryId }))!._id.toString();
    expect(await rules.ruleFromTransaction(id)).toMatchObject({ ok: true });
    expect(await db.transactions.countDocuments({ title: "Bäcker", categoryId })).toBe(2);

    session.userId = "user-b";
    expect(await rules.saveRule({ match: "x", categoryId, kind: null })).toMatchObject({ ok: false });
  });
});

describe("Automatisch buchen (#20)", () => {
  it("bucht faellige Termine einmal, ordnet Importiertes vorher zu und braucht ein Konto", async () => {
    const giro = await createAccount("Giro", "giro", "100");
    const { today } = await load();
    const { addDays } = await import("@/lib/domain/calendar");
    const due = addDays(today, -3);
    expect(await rec.saveRecurring({ type: "expense", title: "Streaming", amount: "9,99", interval: "monthly", nextDue: due, costType: "subscription", accountId: giro, autoBook: true })).toMatchObject({ ok: true });
    expect(await rec.saveRecurring({ type: "expense", title: "Ohne Konto", amount: "5", interval: "monthly", nextDue: due, costType: "subscription", autoBook: true })).toMatchObject({ ok: false });
    // Fitness kam schon per Buchung - wird zugeordnet, nicht doppelt gebucht
    await rec.saveRecurring({ type: "expense", title: "Fitnessstudio", amount: "29", interval: "monthly", nextDue: due, costType: "subscription", accountId: giro, autoBook: true });
    await tx.saveTransaction({ type: "expense", status: "booked", amount: "29", date: due, title: "Fitnessstudio GmbH", accountId: giro });

    const { runAutoBooking } = await import("@/lib/server/auto-book");
    expect(await runAutoBooking()).toEqual({ users: 1, linked: 1, booked: 1 });
    expect(await db.transactions.countDocuments({ title: "Streaming", status: "booked", recurringDue: due })).toBe(1);
    expect(await db.transactions.countDocuments({ title: /Fitness/ })).toBe(1);
    expect(await runAutoBooking()).toEqual({ users: 1, linked: 0, booked: 0 });
  });

  it("Cron-Endpunkt nur mit CRON_SECRET", async () => {
    const { GET } = await import("@/app/api/cron/recurring/route");
    const call = (header?: string) => GET(new Request("http://localhost/api/cron/recurring", { headers: header ? { authorization: header } : {} }));
    delete process.env.CRON_SECRET;
    expect((await call("Bearer x")).status).toBe(503);
    process.env.CRON_SECRET = "geheim";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer falsch")).status).toBe(401);
    expect((await call("Bearer geheim")).status).toBe(200);
    delete process.env.CRON_SECRET;
  });
});

describe("Discord-Benachrichtigungen (#21)", () => {
  it("meldet faellige Zahlungen genau einmal an den eigenen Webhook", async () => {
    const giro = await createAccount("Giro", "giro", "0");
    const { today } = await load();
    const { addDays } = await import("@/lib/domain/calendar");
    await rec.saveRecurring({ type: "expense", title: "Streaming", amount: "9,99", interval: "monthly", nextDue: addDays(today, 1), costType: "subscription", accountId: giro });

    const notify = await import("./notify");
    expect(await notify.saveNotificationSettings({ webhookUrl: "https://example.org/hook", due: true, monthly: true })).toMatchObject({ ok: false });
    expect(await notify.saveNotificationSettings({ webhookUrl: "https://discord.com/api/webhooks/123/abc-DEF", due: true, monthly: false })).toMatchObject({ ok: true });

    const calls: Array<{ url: string; body: { content: string; allowed_mentions: unknown } }> = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const { runNotifications, maskWebhook } = await import("@/lib/server/notify");
    expect(await runNotifications(fake)).toBe(1);
    expect(calls[0].url).toBe("https://discord.com/api/webhooks/123/abc-DEF");
    expect(calls[0].body.content).toContain("Streaming – 9,99 €");
    expect(calls[0].body.allowed_mentions).toEqual({ parse: [] });
    expect(await runNotifications(fake)).toBe(0);
    expect(maskWebhook("https://discord.com/api/webhooks/123456/geheim")).toBe("discord.com/api/webhooks/1234…");

    expect(await notify.saveNotificationSettings({ webhookUrl: "", due: true, monthly: true })).toMatchObject({ ok: true });
    expect(await runNotifications(fake)).toBe(0);
  });
});

describe("Betragsaenderungen", () => {
  it("uebernimmt oder behaelt den Betrag der letzten Zahlung", async () => {
    const giro = await createAccount("Giro", "giro", "0");
    await rec.saveRecurring({ type: "income", title: "Waisenrente", amount: "276,48", interval: "monthly", nextDue: "2026-09-30", costType: "other", accountId: giro });
    const id = (await db.recurring.findOne({}))!._id.toString();
    await rec.settleRecurring({ id, due: "2026-09-30", mode: "book", amount: "278,48" });
    const { amountChanges } = await import("@/lib/domain/amount-changes");
    const loaded = await load();
    expect(amountChanges(loaded.recurring, loaded.transactions)).toHaveLength(1);

    const match = await import("./matching");
    expect(await match.resolveAmountChange({ recurringId: id, accept: false })).toMatchObject({ ok: true });
    let after = await load();
    expect(amountChanges(after.recurring, after.transactions)).toEqual([]);
    expect(await match.resolveAmountChange({ recurringId: id, accept: true })).toMatchObject({ ok: true });
    after = await load();
    expect(after.recurring[0].amountCents).toBe(278_48);
  });
});

describe("Papierkorb und Mehrfachauswahl", () => {
  it("Loeschen landet im Papierkorb, Rueckgaengig holt Buchung und Termin zurueck", async () => {
    const giro = await createAccount("Giro", "giro", "100");
    await rec.saveRecurring({
      type: "expense", title: "Streaming", amount: "12,99", interval: "monthly",
      nextDue: "2026-10-05", costType: "subscription", accountId: giro,
    });
    const id = (await db.recurring.findOne({}))!._id.toString();
    await rec.settleRecurring({ id, due: "2026-10-05", mode: "book" });
    const paid = (await db.transactions.findOne({ recurringId: id }))!;

    const deleted = await tx.deleteTransaction(paid._id.toString());
    expect(deleted).toMatchObject({ ok: true, message: "Buchung gelöscht", undo: expect.any(String) });
    expect(await db.transactions.countDocuments()).toBe(0);
    expect((await db.recurring.findOne({}))!.nextDue).toBe("2026-10-05");

    const { listTrash } = await import("@/lib/server/trash");
    const [entry] = await listTrash("user-a");
    expect(entry).toMatchObject({ label: expect.stringMatching(/^Streaming, 12,99\s€$/), count: 1, fromImport: false });
    expect(entry.expiresAt).not.toBeNull();

    // Doppelklick auf "Rückgängig": nur einmal wiederhergestellt
    const results = await Promise.all([tx.restoreFromTrash((deleted as { undo: string }).undo), tx.restoreFromTrash(entry.id)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const restored = await db.transactions.find({}).toArray();
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ _id: paid._id, recurringId: id, recurringDue: "2026-10-05" });
    expect((await db.recurring.findOne({}))!.nextDue).toBe("2026-11-05");
    expect(await listTrash("user-a")).toEqual([]);
  });

  it("ist der Termin inzwischen anders erledigt, kommt die Buchung ohne Zuordnung zurueck", async () => {
    const giro = await createAccount("Giro", "giro", "100");
    await rec.saveRecurring({
      type: "expense", title: "Streaming", amount: "12,99", interval: "monthly",
      nextDue: "2026-10-05", costType: "subscription", accountId: giro,
    });
    const id = (await db.recurring.findOne({}))!._id.toString();
    await rec.settleRecurring({ id, due: "2026-10-05", mode: "book" });
    const paid = (await db.transactions.findOne({ recurringId: id }))!;
    const deleted = (await tx.deleteTransaction(paid._id.toString())) as { undo: string };
    await rec.settleRecurring({ id, due: "2026-10-05", mode: "book" });

    expect(await tx.restoreFromTrash(deleted.undo)).toMatchObject({ ok: true, message: expect.stringContaining("1 ohne Zuordnung") });
    expect(await db.transactions.countDocuments({ recurringId: id })).toBe(1);
    expect(await db.transactions.findOne({ _id: paid._id })).toMatchObject({ recurringId: null, recurringDue: null });
    expect((await db.recurring.findOne({}))!.nextDue).toBe("2026-11-05");
  });

  it("Mehrfachauswahl: loeschen mit Transfers, Kategorie nur fuer passende Art, Konto, bezahlt", async () => {
    const giro = await createAccount("Giro", "giro", "500");
    const spar = await createAccount("Spar", "savings", "0");
    await tx.saveTransaction({ type: "expense", status: "booked", amount: "10", date: "2026-10-01", title: "Lidl", accountId: giro });
    await tx.saveTransaction({ type: "income", status: "booked", amount: "20", date: "2026-10-02", title: "Erstattung", accountId: giro });
    await tx.saveTransaction({ type: "expense", status: "pending", amount: "30", date: "2099-12-01", title: "Rechnung", accountId: giro });
    await tx.saveTransfer({ fromAccountId: giro, toAccountId: spar, amount: "50", date: "2026-10-03" });
    await db.categories.insertOne({ userId: "user-a", name: "Lebensmittel", kind: "expense", createdAt: new Date() } as never);
    const food = (await db.categories.findOne({ name: "Lebensmittel" }))!._id.toString();
    const ids = Object.fromEntries((await db.transactions.find({}).toArray()).map((doc) => [doc.title, doc._id.toString()]));

    const all = [ids.Lidl, ids.Erstattung, ids.Rechnung, ids["Transfer an Spar"]];
    expect(await tx.updateTransactions({ ids: all, categoryId: food })).toMatchObject({
      ok: true,
      message: "Kategorie „Lebensmittel“ bei 2 Buchungen gesetzt, 1 übersprungen (keine Ausgabe)",
    });
    expect(await db.transactions.countDocuments({ categoryId: food })).toBe(2);
    expect(await tx.updateTransactions({ ids: all, accountId: spar })).toMatchObject({ ok: true, message: "3 Buchungen verschoben" });
    // Das Konto des Transfers bleibt
    expect(await db.transactions.findOne({ title: "Transfer an Spar" })).toMatchObject({ accountId: giro });
    expect(await tx.updateTransactions({ ids: all, booked: true })).toMatchObject({ ok: true, message: expect.stringMatching(/^1 Buchungen/) });
    // Frueher bezahlt als geplant: Buchungsdatum ist heute
    const { todayIn } = await import("@/lib/domain/calendar");
    expect(await db.transactions.findOne({ title: "Rechnung" })).toMatchObject({ status: "booked", date: todayIn("Europe/Berlin") });

    const deleted = await tx.deleteTransactions([ids.Lidl, ids["Transfer an Spar"]]);
    expect(deleted).toMatchObject({ ok: true, message: "3 Buchungen gelöscht" });
    expect(await db.transactions.countDocuments()).toBe(2);
    expect(await tx.restoreFromTrash((deleted as { undo: string }).undo)).toMatchObject({ ok: true, message: "3 Buchungen wiederhergestellt" });
    expect(await db.transactions.countDocuments()).toBe(5);

    // Fremde Nutzer koennen weder loeschen noch aendern noch wiederherstellen
    const again = (await tx.deleteTransactions([ids.Lidl])) as { undo: string };
    session.userId = "user-b";
    expect(await tx.deleteTransactions([ids.Erstattung])).toMatchObject({ ok: false });
    expect(await tx.updateTransactions({ ids: [ids.Erstattung], accountId: giro })).toMatchObject({ ok: false });
    expect(await tx.restoreFromTrash(again.undo)).toMatchObject({ ok: false });
    expect(await tx.purgeFromTrash(again.undo)).toMatchObject({ ok: false });
    session.userId = "user-a";
    expect(await tx.purgeFromTrash()).toMatchObject({ ok: true, message: "Papierkorb geleert" });
    expect(await tx.restoreFromTrash(again.undo)).toMatchObject({ ok: false });
  });

  it("rueckgaengig gemachter Import: wiederherstellbar, aber nicht nach erneutem Import", async () => {
    const giro = await createAccount("Giro", "giro", "0");
    const { importTransactions, undoImport } = await import("./import");
    const rows = [
      { date: "2026-10-01", title: "Lidl", amountCents: 12_50, type: "expense" as const, status: "booked" as const, category: null, note: null },
      { date: "2026-10-02", title: "Bäcker", amountCents: 3_20, type: "expense" as const, status: "booked" as const, category: null, note: null },
    ];
    await importTransactions({ accountId: giro, rows, fileName: "okt.csv" });
    const record = (await db.imports.findOne({}))!;
    expect(await Promise.all([undoImport(record._id), undoImport(record._id)])).toEqual(
      expect.arrayContaining([expect.objectContaining({ ok: true }), expect.objectContaining({ ok: false })]),
    );
    const { listTrash } = await import("@/lib/server/trash");
    const [entry] = await listTrash("user-a");
    expect(entry).toMatchObject({ label: "Import „okt.csv“ (2 Buchungen)", count: 2, fromImport: true, expiresAt: null });

    expect(await tx.restoreFromTrash(entry.id)).toMatchObject({ ok: true });
    expect(await db.transactions.countDocuments({ importId: record._id })).toBe(2);
    expect((await db.imports.findOne({}))!.undoneAt).toBeNull();

    // Rueckgaengig, neu importiert, dann Wiederherstellen: wuerde doppeln
    await undoImport(record._id);
    await importTransactions({ accountId: giro, rows, fileName: "okt.csv" });
    const [again] = await listTrash("user-a");
    expect(await tx.restoreFromTrash(again.id)).toMatchObject({ ok: false, error: expect.stringContaining("neu importiert") });
    expect(await db.transactions.countDocuments()).toBe(2);
  });
});

describe("JSON-Sicherung wiederherstellen", () => {
  async function exportJson() {
    const { exportUserData } = await import("@/lib/server/user-data");
    return JSON.stringify({ exportedAt: new Date().toISOString(), ...(await exportUserData(session.userId)) });
  }

  it("spielt die eigene Sicherung zurueck, sichert vorher und holt den alten Stand wieder", async () => {
    const backup = await import("./backup");
    const giro = await createAccount("Giro", "giro", "100");
    await tx.saveTransaction({ type: "expense", status: "booked", amount: "10", date: "2026-10-01", title: "Lidl", accountId: giro });
    await rec.saveRecurring({ type: "expense", title: "Streaming", amount: "9,99", interval: "monthly", nextDue: "2026-10-20", costType: "subscription", accountId: giro });
    const json = await exportJson();

    // Danach geaendert: Buchung geloescht, neue angelegt
    await tx.deleteTransaction((await db.transactions.findOne({ title: "Lidl" }))!._id.toString());
    await tx.saveTransaction({ type: "expense", status: "booked", amount: "5", date: "2026-10-02", title: "Kiosk", accountId: giro });

    expect(await backup.restoreFromBackup(json)).toMatchObject({ ok: true, message: expect.stringContaining("1 Konten, 1 Buchungen, 1 regelmäßige Zahlungen") });
    const restored = await load();
    expect(restored.transactions.map((entry) => entry.title)).toEqual(["Lidl"]);
    expect(restored.transactions[0].accountId).toBe(giro);
    expect(restored.recurring[0]).toMatchObject({ title: "Streaming", accountId: giro });
    const doc = await db.transactions.findOne({ title: "Lidl" });
    expect(doc!.createdAt).toBeInstanceOf(Date);
    expect(doc!.userId).toBe("user-a");

    const { listSnapshots } = await import("@/lib/server/restore");
    const [snapshot] = await listSnapshots("user-a");
    expect(snapshot.counts).toMatchObject({ transactions: 1, accounts: 1 });
    expect(await backup.restorePreviousState(snapshot.id)).toMatchObject({ ok: true });
    expect((await load()).transactions.map((entry) => entry.title)).toEqual(["Kiosk"]);
  });

  it("lehnt kaputte Dateien und fremde IDs ab, uebernimmt nie fremde userIds", async () => {
    const backup = await import("./backup");
    expect(await backup.restoreFromBackup("kein json")).toMatchObject({ ok: false, error: "Die Datei ist kein gültiges JSON." });
    expect(await backup.restoreFromBackup("{}")).toMatchObject({ ok: false });
    expect(
      await backup.restoreFromBackup(JSON.stringify({ accounts: [], transactions: [{ id: "x", type: "expense", amountCents: -5, date: "2026-10-01", title: "x" }] })),
    ).toMatchObject({ ok: false, error: expect.stringContaining("Eintrag 1 in „transactions“") });

    // Nutzer B hat eine Buchung; A versucht, sie mit einer praeparierten Sicherung zu ueberschreiben
    session.userId = "user-b";
    const giroB = await createAccount("Giro B", "giro", "0");
    await tx.saveTransaction({ type: "income", status: "booked", amount: "50", date: "2026-10-01", title: "Gehalt B", accountId: giroB });
    const foreign = (await db.transactions.findOne({ title: "Gehalt B" }))!._id.toString();
    session.userId = "user-a";
    const crafted = {
      accounts: [],
      transactions: [{ id: foreign, type: "expense", amountCents: 1, date: "2026-10-01", title: "Hack" }],
    };
    expect(await backup.restoreFromBackup(JSON.stringify(crafted))).toMatchObject({ ok: false, error: expect.stringContaining("anderen Zugang") });
    expect(await db.transactions.findOne({ title: "Gehalt B" })).toMatchObject({ userId: "user-b" });

    // Verschachtelte Papierkorb-Eintraege mit fremder userId werden beim Einspielen und Wiederherstellen zu eigenen
    const trashed = {
      accounts: [],
      transactions: [],
      import_trash: [
        {
          id: "aaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "transactions",
          label: "x",
          deletedAt: "2026-10-01T10:00:00.000Z",
          docs: [{ _id: "bbbbbbbbbbbbbbbbbbbbbbbb", userId: "user-b", type: "income", status: "booked", amountCents: 1_000_00, date: "2026-10-01", title: "Fremd", note: null, categoryId: null, recurringId: null }],
        },
      ],
    };
    expect(await backup.restoreFromBackup(JSON.stringify(trashed))).toMatchObject({ ok: true });
    const entry = await db.importTrash.findOne({ userId: "user-a" });
    expect((entry!.docs as Array<{ userId: string }>)[0].userId).toBe("user-a");
    expect(await tx.restoreFromTrash("aaaaaaaaaaaaaaaaaaaaaaaa")).toMatchObject({ ok: true });
    expect(await db.transactions.findOne({ title: "Fremd" })).toMatchObject({ userId: "user-a" });
    expect(await db.transactions.countDocuments({ userId: "user-b" })).toBe(1);
  });
});

describe("Vorlagen", () => {
  it("speichert, ersetzt bei gleichem Titel, loescht nur eigene", async () => {
    const templates = await import("./templates");
    const { loadTemplates } = await import("@/lib/server/data");
    const giro = await createAccount("Giro", "giro", "0");
    expect(await templates.saveTemplate({ type: "expense", title: "Bäcker", amount: "3,20", accountId: giro })).toMatchObject({ ok: true, message: "Vorlage „Bäcker“ gespeichert" });
    expect(await templates.saveTemplate({ type: "expense", title: "Bäcker", amount: "3,50" })).toMatchObject({ ok: true, message: "Vorlage „Bäcker“ aktualisiert" });
    expect(await templates.saveTemplate({ type: "expense", title: "Tanken", amount: "" })).toMatchObject({ ok: true });
    expect(await templates.saveTemplate({ type: "expense", title: "x", amount: "abc" })).toMatchObject({ ok: false });
    const list = await loadTemplates("user-a");
    expect(list.map((entry) => [entry.title, entry.amountCents])).toEqual([["Bäcker", 3_50], ["Tanken", null]]);

    session.userId = "user-b";
    expect(await templates.deleteTemplate(list[0].id)).toMatchObject({ ok: false });
    expect(await templates.saveTemplate({ type: "expense", title: "Fremd", accountId: giro })).toMatchObject({ ok: false, error: "Konto nicht gefunden" });
    session.userId = "user-a";
    expect(await templates.deleteTemplate(list[0].id)).toMatchObject({ ok: true });
    expect(await loadTemplates("user-a")).toHaveLength(1);
  });
});

describe("Aufteilen", () => {
  it("teilt auf, behaelt den Importschutz und hebt wieder auf", async () => {
    const giro = await createAccount("Giro", "giro", "100");
    const food = (await db.categories.insertOne({ userId: "user-a", name: "Lebensmittel", kind: "expense", color: "#000", createdAt: new Date() })).insertedId.toString();
    const home = (await db.categories.insertOne({ userId: "user-a", name: "Haushalt", kind: "expense", color: "#000", createdAt: new Date() })).insertedId.toString();
    const { importTransactions } = await import("./import");
    await importTransactions({ accountId: giro, rows: [{ date: "2026-10-10", title: "Rossmann", amountCents: 30_00, type: "expense", status: "booked", category: null, note: null }] });
    const original = (await db.transactions.findOne({ title: "Rossmann" }))!;
    const id = original._id.toString();

    expect(await tx.splitTransaction({ id, parts: [{ amount: "10", categoryId: food }, { amount: "15", categoryId: home }] })).toMatchObject({ ok: false, error: expect.stringContaining("ergeben 25,00") });
    const results = await Promise.all([
      tx.splitTransaction({ id, parts: [{ amount: "12,50", categoryId: food }, { amount: "17,50", categoryId: home, title: "Putzmittel" }] }),
      tx.splitTransaction({ id, parts: [{ amount: "12,50", categoryId: food }, { amount: "17,50", categoryId: home, title: "Putzmittel" }] }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const parts = await db.transactions.find({ splitGroupId: id }).sort({ amountCents: 1 }).toArray();
    expect(parts.map((part) => [part.title, part.amountCents, part.categoryId])).toEqual([
      ["Rossmann", 12_50, food],
      ["Putzmittel", 17_50, home],
    ]);
    // Teil 1 ist die urspruengliche Buchung: gleicher Importschutz, Kontostand unveraendert
    expect(parts[0]).toMatchObject({ _id: original._id, importHash: original.importHash, importId: original.importId });
    expect((await load()).availability.liquidBalance).toBe(100_00 - 30_00);
    const again = await importTransactions({ accountId: giro, rows: [{ date: "2026-10-10", title: "Rossmann", amountCents: 30_00, type: "expense", status: "booked", category: null, note: null }] });
    expect(again).toMatchObject({ imported: 0, skipped: 1 });

    expect(await tx.unsplitTransaction(parts[1]._id.toString())).toMatchObject({ ok: true });
    const merged = await db.transactions.find({ title: "Rossmann" }).toArray();
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ _id: original._id, amountCents: 30_00, categoryId: null, splitGroupId: null });
    expect(await db.transactions.countDocuments()).toBe(1);
  });
});

describe("Belege", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const form = (transactionId: string, bytes: Uint8Array<ArrayBuffer>, name = "kassenbon.jpg") => {
    const data = new FormData();
    data.set("transactionId", transactionId);
    data.set("file", new File([bytes], name, { type: "image/jpeg" }));
    return data;
  };

  it("haengt an, prueft Typ und Groesse, liefert nur dem Eigentuemer, raeumt verwaiste auf", async () => {
    const receipts = await import("./receipts");
    const store = await import("@/lib/server/receipts");
    const giro = await createAccount("Giro", "giro", "0");
    await tx.saveTransaction({ type: "expense", status: "booked", amount: "12,50", date: "2026-10-10", title: "Lidl", accountId: giro });
    const id = (await db.transactions.findOne({ title: "Lidl" }))!._id.toString();

    expect(await receipts.uploadReceipt(form(id, jpeg))).toMatchObject({ ok: true });
    expect(await receipts.uploadReceipt(form(id, new Uint8Array(new TextEncoder().encode("<script>alert(1)</script>")), "x.jpg"))).toMatchObject({ ok: false, error: expect.stringContaining("Nur Fotos") });
    expect(await receipts.uploadReceipt(form(id, new Uint8Array(2 * 1024 * 1024 + 1)))).toMatchObject({ ok: false, error: expect.stringContaining("zu groß") });
    const list = await receipts.getReceipts(id);
    expect(list).toEqual([expect.objectContaining({ fileName: "kassenbon.jpg", contentType: "image/jpeg", size: 8 })]);
    expect((await load()).transactions[0].receiptCount).toBe(1);

    // Hoechstens 5, auch bei parallelen Uploads
    await Promise.all(Array.from({ length: 6 }, () => receipts.uploadReceipt(form(id, jpeg))));
    expect(await db.receipts.countDocuments({ transactionId: id })).toBe(5);
    expect((await db.transactions.findOne({ title: "Lidl" }))!.receiptCount).toBe(5);

    session.userId = "user-b";
    expect(await receipts.getReceipts(id)).toEqual([]);
    expect(await receipts.uploadReceipt(form(id, jpeg))).toMatchObject({ ok: false, error: "Buchung nicht gefunden" });
    expect(await receipts.removeReceipt(list[0].id)).toMatchObject({ ok: false });
    expect(await store.getReceipt("user-b", list[0].id)).toBeNull();
    session.userId = "user-a";
    expect((await store.getReceipt("user-a", list[0].id))!.data.buffer.byteLength).toBe(8);

    expect(await receipts.removeReceipt(list[0].id)).toMatchObject({ ok: true });
    expect((await db.transactions.findOne({ title: "Lidl" }))!.receiptCount).toBe(4);

    // Im Papierkorb bleiben die Belege, nach endgueltigem Loeschen werden sie aufgeraeumt
    await tx.deleteTransaction(id);
    expect(await store.cleanupReceipts()).toBe(0);
    await tx.purgeFromTrash();
    expect(await store.cleanupReceipts()).toBe(4);
    expect(await db.receipts.countDocuments()).toBe(0);
  });
});
