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
});
