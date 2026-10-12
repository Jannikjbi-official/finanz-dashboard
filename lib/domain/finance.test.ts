import { describe, expect, it } from "vitest";
import { chargesByMonth, fixedCostSummary, nextCharge, subscriptionSummary } from "./commitments";
import { accountBalance, accountBalances, accountHistory, monthSummary, monthlyHistory, spendingBaseline } from "./ledger";
import { availability, openItems, savingsEstimate } from "./overview";
import { cancellationDeadline, monthlyEquivalent, openDues, reopenDue, settleDue, yearlyTotal } from "./recurring";
import type { Account, Recurring, Transaction } from "./types";

const TODAY = "2026-10-12";

function account(overrides: Partial<Account> = {}): Account {
  return { id: "giro", name: "Girokonto", kind: "giro", startBalanceCents: 0, liquid: true, archived: false, ...overrides };
}

let txCounter = 0;
function tx(overrides: Partial<Transaction> = {}): Transaction {
  txCounter += 1;
  return {
    id: `tx${String(txCounter).padStart(4, "0")}`,
    type: "expense",
    status: "booked",
    amountCents: 1000,
    date: TODAY,
    title: "Buchung",
    note: null,
    categoryId: null,
    accountId: "giro",
    transferGroupId: null,
    recurringId: null,
    recurringDue: null,
    ...overrides,
  };
}

function rec(overrides: Partial<Recurring> = {}): Recurring {
  return {
    id: "r1",
    type: "expense",
    title: "Abo",
    provider: null,
    amountCents: 1000,
    interval: "monthly",
    startDate: "2026-01-20",
    nextDue: "2026-10-20",
    status: "active",
    costType: "subscription",
    categoryId: null,
    accountId: "giro",
    endDate: null,
    cancelledOn: null,
    noticePeriod: null,
    note: null,
    ...overrides,
  };
}

describe("Abonnementkosten", () => {
  it("rechnet Intervalle korrekt auf Monat und Jahr", () => {
    expect(monthlyEquivalent({ amountCents: 120_00, interval: "yearly" })).toBe(10_00);
    expect(yearlyTotal({ amountCents: 120_00, interval: "yearly" })).toBe(120_00);
    expect(monthlyEquivalent({ amountCents: 30_00, interval: "quarterly" })).toBe(10_00);
    expect(yearlyTotal({ amountCents: 30_00, interval: "quarterly" })).toBe(120_00);
    expect(monthlyEquivalent({ amountCents: 12_99, interval: "monthly" })).toBe(12_99);
    expect(yearlyTotal({ amountCents: 12_99, interval: "monthly" })).toBe(155_88);
    // 52 Wochen / 12 Monate
    expect(monthlyEquivalent({ amountCents: 3_00, interval: "weekly" })).toBe(13_00);
    expect(yearlyTotal({ amountCents: 3_00, interval: "weekly" })).toBe(156_00);
  });

  it("summiert nur aktive Abos; gekuendigte und pausierte zaehlen nicht", () => {
    const summary = subscriptionSummary(
      [
        rec({ id: "netflix", amountCents: 13_99 }),
        rec({ id: "jahr", amountCents: 120_00, interval: "yearly", startDate: "2026-03-01", nextDue: "2027-03-01" }),
        rec({ id: "pause", status: "paused" }),
        rec({ id: "weg", status: "cancelled" }),
        rec({ id: "miete", costType: "rent", amountCents: 800_00 }),
      ],
      TODAY,
    );
    expect(summary.activeCount).toBe(2);
    expect(summary.monthlyTotal).toBe(13_99 + 10_00);
    expect(summary.yearlyTotal).toBe(13_99 * 12 + 120_00);
    expect(summary.mostExpensive.map((entry) => entry.id)).toEqual(["netflix", "jahr"]);
  });

  it("zeigt beim Jahresabo die echte Abbuchung im Faelligkeitsmonat, nicht 10 € pro Monat", () => {
    const yearly = rec({ amountCents: 120_00, interval: "yearly", startDate: "2026-03-01", nextDue: "2027-03-01" });
    const months = chargesByMonth([yearly], TODAY, 12);
    expect(months).toHaveLength(12);
    expect(months.find((month) => month.month === "2027-03")?.total).toBe(120_00);
    expect(months.filter((month) => month.total > 0)).toHaveLength(1);
  });

  it("findet die naechste Abbuchung", () => {
    const charge = nextCharge(
      [rec({ id: "a", nextDue: "2026-10-25" }), rec({ id: "b", nextDue: "2026-10-14" }), rec({ id: "c", status: "paused", nextDue: "2026-10-13" })],
      TODAY,
    );
    expect(charge).toMatchObject({ date: "2026-10-14", entry: { id: "b" } });
  });

  it("gekuendigtes Abo bucht nur bis zum hinterlegten Vertragsende ab", () => {
    const cancelled = rec({ status: "cancelled", nextDue: "2026-10-20", endDate: "2026-12-31" });
    expect(openDues(cancelled, "2027-06-30")).toEqual(["2026-10-20", "2026-11-20", "2026-12-20"]);

    const withoutEnd = rec({ status: "cancelled", nextDue: "2026-10-20", endDate: null });
    expect(openDues(withoutEnd, "2027-06-30")).toEqual([]);

    const summary = subscriptionSummary([cancelled, withoutEnd], TODAY);
    expect(summary.runningOut).toHaveLength(1);
    expect(summary.runningOut[0].remaining).toBe(30_00);
  });

  it("pausierte und archivierte Eintraege erzeugen keine Termine", () => {
    expect(openDues(rec({ status: "paused" }), "2027-12-31")).toEqual([]);
    expect(openDues(rec({ status: "archived" }), "2027-12-31")).toEqual([]);
  });

  it("berechnet die Kuendigungsfrist nur aus hinterlegten Angaben", () => {
    expect(cancellationDeadline({ endDate: "2026-12-31", noticePeriod: { value: 3, unit: "months" } })).toBe("2026-09-30");
    expect(cancellationDeadline({ endDate: "2026-12-31", noticePeriod: { value: 2, unit: "weeks" } })).toBe("2026-12-17");
    expect(cancellationDeadline({ endDate: "2026-12-31", noticePeriod: null })).toBeNull();
    expect(cancellationDeadline({ endDate: null, noticePeriod: { value: 1, unit: "months" } })).toBeNull();
  });
});

describe("Termine, Monatsenden und Schaltjahre", () => {
  it("haelt den Ankertag am Monatsende", () => {
    const entry = rec({ startDate: "2026-01-31", nextDue: "2026-01-31" });
    expect(openDues(entry, "2026-05-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("Jahresabo am 29. Februar", () => {
    const entry = rec({ interval: "yearly", startDate: "2024-02-29", nextDue: "2025-02-28" });
    expect(openDues(entry, "2028-12-31")).toEqual(["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  });

  it("erledigt nur den naechsten offenen Termin und kann ihn wieder oeffnen", () => {
    const entry = rec({ startDate: "2026-01-31", nextDue: "2026-02-28" });
    expect(settleDue(entry, "2026-02-28")).toBe("2026-03-31");
    // Doppelklick / veraltete Ansicht: falscher Termin wird abgelehnt
    expect(settleDue(entry, "2026-01-31")).toBeNull();

    const after = { ...entry, nextDue: "2026-03-31" };
    expect(reopenDue(after, "2026-02-28")).toBe("2026-02-28");
    // aelterer Termin: nicht zuruecksetzen, sonst wuerde Spaeteres wieder offen
    expect(reopenDue(after, "2026-01-31")).toBeNull();
  });
});

describe("Kontostaende und Transfers", () => {
  it("zaehlt nur gebuchte Buchungen", () => {
    const giro = account({ startBalanceCents: 500_00 });
    const list = [
      tx({ type: "income", amountCents: 2000_00 }),
      tx({ amountCents: 300_00 }),
      tx({ amountCents: 99_00, status: "pending" }),
      tx({ type: "income", amountCents: 50_00, status: "pending" }),
    ];
    expect(accountBalance(giro, list)).toBe(500_00 + 2000_00 - 300_00);
  });

  it("Transfer verschiebt Geld zwischen Konten, ist aber weder Einnahme noch Ausgabe", () => {
    const giro = account({ startBalanceCents: 1000_00 });
    const savings = account({ id: "spar", kind: "savings", liquid: false, startBalanceCents: 0 });
    const list = [
      tx({ amountCents: 200_00, transferGroupId: "t1", accountId: "giro", date: "2026-10-05" }),
      tx({ type: "income", amountCents: 200_00, transferGroupId: "t1", accountId: "spar", date: "2026-10-05" }),
      tx({ amountCents: 50_00, date: "2026-10-06" }),
    ];
    const balances = accountBalances([giro, savings], list);
    expect(balances.get("giro")).toBe(750_00);
    expect(balances.get("spar")).toBe(200_00);

    const month = monthSummary(list, "2026-10");
    expect(month.income).toBe(0);
    expect(month.expense).toBe(50_00);

    const result = availability({ accounts: [giro, savings], transactions: list, recurring: [], today: TODAY });
    expect(result.totalBalance).toBe(950_00);
    expect(result.liquidBalance).toBe(750_00);
  });

  it("Kontoverlauf zeigt den Saldo nach jeder Buchung", () => {
    const giro = account({ startBalanceCents: 100_00 });
    const list = [
      tx({ id: "a", type: "income", amountCents: 50_00, date: "2026-10-01" }),
      tx({ id: "b", amountCents: 30_00, date: "2026-10-02" }),
      tx({ id: "c", amountCents: 999_00, date: "2026-10-03", status: "pending" }),
    ];
    expect(accountHistory(giro, list).map((entry) => [entry.tx.id, entry.balanceAfter])).toEqual([
      ["b", 120_00],
      ["a", 150_00],
    ]);
  });
});

describe("Aktuell verfuegbar", () => {
  const giro = account({ startBalanceCents: 1000_00 });

  it("zieht Faelliges und bis Monatsende Geplantes ab, aber zaehlt erwartete Einnahmen nicht dazu", () => {
    const list = [
      tx({ amountCents: 100_00, date: "2026-10-01" }), // bezahlt
      tx({ amountCents: 40_00, date: "2026-10-10", status: "pending", title: "Rechnung offen" }), // faellig, unbezahlt
      tx({ amountCents: 25_00, date: "2026-10-28", status: "pending" }), // geplant
      tx({ amountCents: 70_00, date: "2026-11-03", status: "pending" }), // naechster Monat: zaehlt nicht
      tx({ type: "income", amountCents: 300_00, date: "2026-10-30", status: "pending" }), // erwartet
    ];
    const recurring = [
      rec({ id: "miete", costType: "rent", amountCents: 500_00, startDate: "2026-01-01", nextDue: "2026-11-01" }),
      rec({ id: "abo", amountCents: 10_00, nextDue: "2026-10-20" }),
      rec({ id: "gehalt", type: "income", costType: "other", amountCents: 2000_00, startDate: "2026-01-30", nextDue: "2026-10-30" }),
    ];

    const result = availability({ accounts: [giro], transactions: list, recurring, today: TODAY });
    expect(result.liquidBalance).toBe(900_00);
    expect(result.dueUnpaid.total).toBe(40_00);
    expect(result.plannedExpenses.total).toBe(25_00 + 10_00);
    expect(result.expectedIncome.total).toBe(2300_00);
    expect(result.available).toBe(900_00 - 40_00 - 35_00);
    expect(result.projectedMonthEnd).toBe(result.available + 2300_00);
  });

  it("zieht eine bereits bezahlte wiederkehrende Zahlung nicht erneut ab", () => {
    const entry = rec({ id: "abo", amountCents: 10_00, startDate: "2026-01-05", nextDue: "2026-10-05" });

    const before = availability({ accounts: [giro], transactions: [], recurring: [entry], today: TODAY });
    expect(before.dueUnpaid.total).toBe(10_00);
    expect(before.available).toBe(990_00);

    // Als bezahlt markieren: Buchung entsteht, nextDue rueckt weiter
    const paid = tx({ amountCents: 10_00, date: "2026-10-05", recurringId: "abo", recurringDue: "2026-10-05" });
    const advanced = { ...entry, nextDue: settleDue(entry, "2026-10-05")! };
    const after = availability({ accounts: [giro], transactions: [paid], recurring: [advanced], today: TODAY });

    expect(after.liquidBalance).toBe(990_00);
    expect(after.dueUnpaid.total).toBe(0);
    // November-Termin liegt nach Monatsende
    expect(after.plannedExpenses.total).toBe(0);
    expect(after.available).toBe(990_00);
  });

  it("zaehlt einen Termin auch bei woechentlichem Intervall nur einmal", () => {
    const weekly = rec({ interval: "weekly", amountCents: 5_00, startDate: "2026-10-01", nextDue: "2026-10-15" });
    const items = openItems([], [weekly], "2026-10-31");
    expect(items.map((item) => item.date)).toEqual(["2026-10-15", "2026-10-22", "2026-10-29"]);
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
  });

  it("ignoriert Posten auf nicht liquiden Konten", () => {
    const savings = account({ id: "spar", kind: "savings", liquid: false, startBalanceCents: 5000_00 });
    const result = availability({
      accounts: [giro, savings],
      transactions: [tx({ accountId: "spar", status: "pending", amountCents: 100_00, date: "2026-10-20" })],
      recurring: [rec({ accountId: "spar", nextDue: "2026-10-25" })],
      today: TODAY,
    });
    expect(result.available).toBe(1000_00);
    expect(result.totalBalance).toBe(6000_00);
  });

  it("archivierte Konten zaehlen nicht", () => {
    const old = account({ id: "alt", archived: true, startBalanceCents: 300_00 });
    const result = availability({ accounts: [giro, old], transactions: [], recurring: [], today: TODAY });
    expect(result.totalBalance).toBe(1000_00);
    expect(result.liquidBalance).toBe(1000_00);
  });

  it("Prognose: Ueberfaelliges heute, gleiche Tage Ausgaben vor Einnahmen, Tiefpunkt", () => {
    const result = availability({
      accounts: [account({ startBalanceCents: 100_00 })],
      transactions: [
        tx({ status: "pending", amountCents: 20_00, date: "2026-10-01" }),
        tx({ status: "pending", type: "income", amountCents: 500_00, date: "2026-10-20" }),
        tx({ status: "pending", amountCents: 150_00, date: "2026-10-20" }),
      ],
      recurring: [],
      today: TODAY,
    });
    expect(result.forecast.map((point) => [point.date, point.balanceAfter])).toEqual([
      [TODAY, 80_00],
      ["2026-10-20", -70_00],
      ["2026-10-20", 430_00],
    ]);
    expect(result.lowestPoint).toEqual({ date: "2026-10-20", balance: -70_00 });
  });

  it("funktioniert ohne jegliche Daten", () => {
    const result = availability({ accounts: [], transactions: [], recurring: [], today: TODAY });
    expect(result).toMatchObject({
      totalBalance: 0,
      liquidBalance: 0,
      available: 0,
      projectedMonthEnd: 0,
      forecast: [],
    });
    expect(subscriptionSummary([], TODAY)).toMatchObject({ activeCount: 0, monthlyTotal: 0, nextCharge: null });
    expect(fixedCostSummary([])).toMatchObject({ monthlyExpenses: 0, byType: [] });
    expect(monthlyHistory([], "2026-10")).toEqual([]);
    expect(spendingBaseline([], TODAY)).toBeNull();
    const current = monthSummary([], "2026-10");
    expect(savingsEstimate({ current, availability: result, baseline: null })).toBeNull();
  });
});

describe("Monate, Historie und Sparpotenzial", () => {
  const list = [
    tx({ type: "income", amountCents: 2000_00, date: "2026-08-01" }),
    tx({ amountCents: 800_00, date: "2026-08-03", recurringId: "miete" }),
    tx({ amountCents: 310_00, date: "2026-08-15" }),
    tx({ type: "income", amountCents: 2000_00, date: "2026-09-01" }),
    tx({ amountCents: 800_00, date: "2026-09-03", recurringId: "miete" }),
    tx({ amountCents: 300_00, date: "2026-09-20" }),
    tx({ type: "income", amountCents: 2000_00, date: "2026-10-01" }),
    tx({ amountCents: 800_00, date: "2026-10-03", recurringId: "miete" }),
    tx({ amountCents: 120_00, date: "2026-10-08" }),
  ];

  it("trennt feste und variable Ausgaben", () => {
    expect(monthSummary(list, "2026-09")).toMatchObject({ income: 2000_00, expense: 1100_00, fixed: 800_00, variable: 300_00, net: 900_00 });
  });

  it("Historie beginnt beim ersten Monat mit Daten", () => {
    const history = monthlyHistory(list, "2026-10", 12);
    expect(history.map((month) => month.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("Durchschnitt nur aus abgeschlossenen Monaten", () => {
    const baseline = spendingBaseline(list, TODAY)!;
    expect(baseline.months).toEqual(["2026-08", "2026-09"]);
    expect(baseline.averageExpense).toBe(1105_00);
    expect(baseline.variablePerDay).toBeCloseTo((310_00 + 300_00) / 61);
  });

  it("realistisches Sparpotenzial beruecksichtigt Verpflichtungen und variable Ausgaben", () => {
    const giro = account({ startBalanceCents: 0 });
    const recurring = [rec({ id: "abo", amountCents: 15_00, nextDue: "2026-10-20" })];
    const a = availability({ accounts: [giro], transactions: list, recurring, today: TODAY });
    const baseline = spendingBaseline(list, TODAY);
    const estimate = savingsEstimate({ current: monthSummary(list, "2026-10"), availability: a, baseline })!;

    expect(estimate.income).toBe(2000_00);
    expect(estimate.committed).toBe(920_00 + 15_00);
    expect(estimate.remainingDays).toBe(19);
    expect(estimate.variableReserve).toBe(Math.round(((310_00 + 300_00) / 61) * 19));
    expect(estimate.amount).toBe(2000_00 - 935_00 - estimate.variableReserve!);
  });
});
