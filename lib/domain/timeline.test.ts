import { describe, expect, it } from "vitest";
import { availability } from "./overview";
import { liquidTimeline, netWorthHistory } from "./timeline";
import type { Account, Recurring, Transaction } from "./types";

const giro: Account = { id: "giro", name: "Giro", kind: "giro", startBalanceCents: 0, balanceAnchor: { date: "2026-10-13", amountCents: 883_85 }, liquid: true, archived: false };
const spar: Account = { id: "spar", name: "Spar", kind: "savings", startBalanceCents: 1000_00, balanceAnchor: null, liquid: false, archived: false };

let seq = 0;
const tx = (date: string, type: "income" | "expense", amountCents: number, accountId = "giro", overrides: Partial<Transaction> = {}): Transaction => ({
  id: `t${(seq += 1)}`,
  type,
  status: "booked",
  amountCents,
  date,
  title: `${type} ${date}`,
  note: null,
  categoryId: null,
  accountId,
  transferGroupId: null,
  recurringId: null,
  recurringDue: null,
  ...overrides,
});

const rent: Recurring = {
  id: "r", type: "expense", title: "Miete", provider: null, amountCents: 300_00, interval: "monthly", startDate: "2026-10-20", nextDue: "2026-10-20",
  status: "active", costType: "rent", categoryId: null, accountId: "giro", endDate: null, cancelledOn: null, noticePeriod: null, note: null,
};

describe("Kontostand-Verlauf", () => {
  it("rechnet vom Anker rueckwaerts und haengt die Prognose bis Monatsende an", () => {
    const transactions = [
      tx("2026-10-10", "expense", 20_00),
      tx("2026-10-12", "income", 50_00),
      tx("2026-10-12", "expense", 5_00, "spar"),
      tx("2026-10-14", "expense", 10_00, "giro", { status: "pending" }),
    ];
    const today = "2026-10-14";
    const avail = availability({ accounts: [giro, spar], transactions, recurring: [rent], today });
    const points = liquidTimeline({ accounts: [giro, spar], transactions, today, forecast: avail.forecast, days: 10 });

    // Datenbeginn 10.10.: ein Tag davor ist der Ausgangsstand
    expect(points[0]).toMatchObject({ date: "2026-10-09", balance: 853_85, forecast: false });
    expect(points.find((point) => point.date === "2026-10-10")).toMatchObject({ balance: 833_85, changes: [{ amount: -20_00 }] });
    // Sparkonto zaehlt nicht; heute = Anker (keine Buchung danach)
    expect(points.filter((point) => !point.forecast).at(-1)).toMatchObject({ date: "2026-10-14", balance: 883_85 });
    const future = points.filter((point) => point.forecast);
    expect(future.map((point) => [point.date, point.balance])).toEqual([
      ["2026-10-14", 873_85],
      ["2026-10-20", 573_85],
      ["2026-10-31", 573_85],
    ]);
    expect(future.at(-1)!.balance).toBe(avail.projectedMonthEnd);
  });

  it("Vermoegen je Monatsende ab Datenbeginn", () => {
    const transactions = [tx("2026-08-15", "income", 100_00), tx("2026-09-10", "expense", 30_00), tx("2026-10-01", "income", 5_00, "spar")];
    const points = netWorthHistory([{ ...giro, balanceAnchor: null, startBalanceCents: 200_00 }, spar], transactions, "2026-10-14", 12);
    expect(points.map((point) => [point.date, point.total, point.liquid])).toEqual([
      ["2026-08-14", 1200_00, 200_00],
      ["2026-08-31", 1300_00, 300_00],
      ["2026-09-30", 1270_00, 270_00],
      ["2026-10-14", 1275_00, 270_00],
    ]);
    expect(points.at(-1)!.current).toBe(true);
    expect(netWorthHistory([giro], [], "2026-10-14")).toEqual([]);
  });
});
