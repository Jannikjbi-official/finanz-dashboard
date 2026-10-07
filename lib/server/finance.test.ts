import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";
import { addDays, todayIn } from "@/lib/domain/calendar";

let env: Awaited<ReturnType<typeof startTestMongo>>;

beforeAll(async () => {
  env = await startTestMongo("finance");
});

afterAll(async () => {
  await env?.stop();
});

describe("Finanzbild aus der Datenbank", () => {
  it("rechnet liquide Staende bis heute, ohne Umbuchungen und Zukunftsbuchungen", async () => {
    const mongo = await import("@/lib/mongo");
    const { loadFinancialPicture, getAccountBalances } = await import("./finance");
    const today = todayIn("Europe/Berlin");
    const now = new Date();
    const userId = "u-finance";

    const giro = await mongo.accounts.insertOne({
      userId, name: "Giro", kind: "giro", startBalanceCents: 1000_00, color: "#000000",
      icon: "", archived: false, createdAt: now,
    });
    const savings = await mongo.accounts.insertOne({
      userId, name: "Tagesgeld", kind: "savings", startBalanceCents: 5000_00, color: "#000000",
      icon: "", archived: false, createdAt: now,
    });
    const giroId = giro.insertedId.toString();
    const savingsId = savings.insertedId.toString();

    const tx = {
      userId, note: null, categoryId: null, recurringId: null, createdAt: now,
    };
    await mongo.transactions.insertMany([
      { ...tx, type: "expense", amountCents: 100_00, title: "Einkauf", date: today, accountId: giroId },
      // Zukunft - zaehlt heute noch nicht
      { ...tx, type: "expense", amountCents: 50_00, title: "Termin", date: addDays(today, 3), accountId: giroId },
      // Umbuchung Giro -> Tagesgeld
      { ...tx, type: "expense", amountCents: 200_00, title: "Umbuchung an Tagesgeld", date: today, accountId: giroId, transferGroupId: "t1" },
      { ...tx, type: "income", amountCents: 200_00, title: "Umbuchung von Giro", date: today, accountId: savingsId, transferGroupId: "t1" },
    ]);
    await mongo.recurring.insertOne({
      userId, type: "expense", amountCents: 300_00, title: "Miete", interval: "monthly",
      categoryId: null, startDate: addDays(today, 10), nextDue: addDays(today, 10),
      active: true, note: null, createdAt: now,
    });

    const balances = await getAccountBalances(userId, today);
    expect(balances.find((a) => a.id === giroId)).toMatchObject({
      balanceCents: 700_00,
      scheduledBalanceCents: 650_00,
      liquid: true,
    });
    expect(balances.find((a) => a.id === savingsId)?.liquid).toBe(false);

    const picture = await loadFinancialPicture(userId);
    // Nur das Girokonto ist liquide
    expect(picture.openingBalanceCents).toBe(700_00);
    expect(picture.monthly.fixedCents).toBe(300_00);
    // Reserve automatisch = ein Monat Fixkosten
    expect(picture.reserve).toEqual({ reserveCents: 300_00, reserveSource: "fixed-costs" });
    expect(picture.forecast.events.some((e) => e.label === "Miete")).toBe(true);
    // Schon ausgegeben: ohne Umbuchung und ohne die Buchung in der Zukunft
    expect(picture.monthly.variableSpentThisMonthCents).toBe(100_00);
  });
});
