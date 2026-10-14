import { describe, expect, it } from "vitest";
import { buildDashboard } from "./dashboard";
import type { Account, Recurring, Transaction } from "./types";

const TODAY = "2026-10-28";
const giro: Account = { id: "giro", name: "Giro", kind: "giro", startBalanceCents: 500_00, balanceAnchor: null, liquid: true, archived: false };

const sub = (overrides: Partial<Recurring>): Recurring => ({
  id: "s",
  type: "expense",
  title: "Abo",
  provider: null,
  amountCents: 10_00,
  interval: "monthly",
  startDate: "2026-01-05",
  nextDue: "2026-11-05",
  status: "active",
  costType: "subscription",
  categoryId: null,
  accountId: "giro",
  endDate: null,
  cancelledOn: null,
  noticePeriod: null,
  note: null,
  ...overrides,
});

describe("Startseite", () => {
  it("funktioniert ohne Daten", () => {
    const dashboard = buildDashboard({ accounts: [], transactions: [], recurring: [], today: TODAY });
    expect(dashboard.hasAccounts).toBe(false);
    expect(dashboard.hasData).toBe(false);
    expect(dashboard.history).toEqual([]);
    expect(dashboard.upcoming).toEqual([]);
    expect(dashboard.savings).toBeNull();
    expect(dashboard.subscriptionShare).toBeNull();
  });

  it("zeigt kurz vor Monatsende auch die Zahlungen der naechsten 14 Tage, ohne sie abzuziehen", () => {
    const dashboard = buildDashboard({ accounts: [giro], transactions: [], recurring: [sub({})], today: TODAY });
    expect(dashboard.upcoming).toHaveLength(1);
    expect(dashboard.upcoming[0]).toMatchObject({ balanceAfter: null, item: { date: "2026-11-05" } });
    // Termin im November gehoert nicht zum Oktober
    expect(dashboard.upcomingTotalUntilMonthEnd).toBe(0);
    expect(dashboard.availability.available).toBe(500_00);
  });

  it("berechnet den Abo-Anteil ohne Historie aus den festen Kosten", () => {
    const dashboard = buildDashboard({
      accounts: [giro],
      transactions: [],
      recurring: [sub({ id: "a" }), sub({ id: "miete", costType: "rent", amountCents: 790_00 })],
      today: TODAY,
    });
    expect(dashboard.shareBase).toBe("fixed");
    expect(dashboard.subscriptionShare).toBeCloseTo(10 / 800);
  });

  it("zaehlt nur bezahlte wiederkehrende Ausgaben des Monats als bereits bezahlt", () => {
    const paid: Transaction = {
      id: "t1", type: "expense", status: "booked", amountCents: 10_00, date: "2026-10-05", title: "Abo", note: null,
      categoryId: null, accountId: "giro", transferGroupId: null, recurringId: "s", recurringDue: "2026-10-05",
    };
    const dashboard = buildDashboard({ accounts: [giro], transactions: [paid, { ...paid, id: "t2", date: "2026-09-05" }], recurring: [sub({})], today: TODAY });
    expect(dashboard.paidThisMonth.map((tx) => tx.id)).toEqual(["t1"]);
  });

  it("rechnet nicht mit einem Monat, der erst am 30. beginnt (#18)", () => {
    // Daten ab 30.09.: September ist unvollstaendig
    const booked = (id: string, date: string, amountCents: number, type: "income" | "expense" = "expense"): Transaction => ({
      id, type, status: "booked", amountCents, date, title: id, note: null, categoryId: null, accountId: "giro",
      transferGroupId: null, recurringId: null, recurringDue: null,
    });
    const transactions = [
      booked("rente", "2026-09-30", 278_48, "income"),
      booked("lidl", "2026-09-30", 30_07),
      booked("stadt", "2026-10-07", 1035_54, "income"),
      booked("okt", "2026-10-05", 50_00),
    ];
    const recurring = [
      sub({ id: "a", amountCents: 207_00 }),
      sub({ id: "miete", costType: "rent", amountCents: 127_99 }),
    ];
    const dashboard = buildDashboard({ accounts: [giro], transactions, recurring, today: "2026-10-14" });

    expect(dashboard.baseline).toBeNull();
    expect(dashboard.previousPartialFrom).toBe("2026-09-30");
    expect(dashboard.shareBase).toBe("fixed");
    expect(dashboard.subscriptionShare).toBeCloseTo(207 / 334.99);
    expect(dashboard.savings?.variableReserve).toBeNull();
    expect(dashboard.history.find((month) => month.month === "2026-09")).toMatchObject({ partial: true, partialFrom: "2026-09-30" });
  });

  it("kappt Sparbar auf den voraussichtlichen Kontostand und warnt nur bei echtem Absinken", () => {
    const overdrawn: Account = { ...giro, startBalanceCents: -18_16 };
    const income: Transaction = {
      id: "gehalt", type: "income", status: "booked", amountCents: 2000_00, date: "2026-10-02", title: "Gehalt", note: null,
      categoryId: null, accountId: "anderes", transferGroupId: null, recurringId: null, recurringDue: null,
    };
    const dashboard = buildDashboard({ accounts: [overdrawn], transactions: [income], recurring: [], today: "2026-10-14" });
    // Monatsfluss +2.000 €, aber auf dem Konto sind nur -18,16 €
    expect(dashboard.savings).toMatchObject({ amount: -18_16, cappedByBalance: true });
    expect(dashboard.availability.startsNegative).toBe(true);
    expect(dashboard.availability.dip).toBeNull();
  });

  it("zieht von der Prognose geschaetzte variable Ausgaben ab, wenn es einen vollen Monat gibt", () => {
    const spent: Transaction = {
      id: "sep", type: "expense", status: "booked", amountCents: 300_00, date: "2026-09-01", title: "Einkauf", note: null,
      categoryId: null, accountId: "giro", transferGroupId: null, recurringId: null, recurringDue: null,
    };
    const dashboard = buildDashboard({ accounts: [giro], transactions: [spent], recurring: [], today: "2026-10-21" });
    // 300 € in 30 Tagen = 10 €/Tag, 10 Resttage
    expect(dashboard.variableForecast).toEqual({ reserve: 100_00, projected: dashboard.availability.projectedMonthEnd - 100_00 });
    expect(buildDashboard({ accounts: [giro], transactions: [], recurring: [], today: "2026-10-21" }).variableForecast).toBeNull();
  });
});
