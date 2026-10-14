import { describe, expect, it } from "vitest";
import { monthCalendar } from "./month-calendar";
import type { Recurring, Transaction } from "./types";

const tx = (id: string, date: string, type: "income" | "expense", amountCents: number, overrides: Partial<Transaction> = {}): Transaction => ({
  id, type, status: "booked", amountCents, date, title: id, note: null, categoryId: null, accountId: "giro", transferGroupId: null, recurringId: null, recurringDue: null, ...overrides,
});
const sub: Recurring = {
  id: "abo", type: "expense", title: "Streaming", provider: null, amountCents: 9_99, interval: "monthly", startDate: "2026-09-03", nextDue: "2026-10-03",
  status: "active", costType: "subscription", categoryId: null, accountId: "giro", endDate: null, cancelledOn: null, noticePeriod: null, note: null,
};

describe("Monatskalender", () => {
  it("Raster von Montag bis Sonntag, Buchungen und offene Termine je Tag", () => {
    const calendar = monthCalendar(
      [
        tx("lidl", "2026-10-01", "expense", 12_00),
        tx("rente", "2026-10-01", "income", 276_48),
        tx("umbuchung", "2026-10-02", "expense", 50_00, { transferGroupId: "g" }),
        tx("rechnung", "2026-10-20", "expense", 30_00, { status: "pending" }),
      ],
      [sub],
      "2026-10",
      "2026-10-14",
    );
    // Oktober 2026: 1. ist ein Donnerstag -> Raster ab Mo 28.09. bis So 01.11.
    expect(calendar.weeks).toHaveLength(5);
    expect(calendar.weeks[0][0]).toMatchObject({ date: "2026-09-28", inMonth: false });
    expect(calendar.weeks[4][6]).toMatchObject({ date: "2026-11-01", inMonth: false });

    const day = (date: string) => calendar.weeks.flat().find((entry) => entry.date === date)!;
    expect(day("2026-10-01")).toMatchObject({ income: 276_48, expense: 12_00 });
    expect(day("2026-10-02").entries).toEqual([]);
    // Abo am 3. noch offen und schon vorbei: ueberfaellig
    expect(day("2026-10-03").entries).toEqual([expect.objectContaining({ title: "Streaming", kind: "open", overdue: true, amount: -9_99, recurringId: "abo" })]);
    expect(day("2026-10-14").isToday).toBe(true);
    expect(day("2026-10-20")).toMatchObject({ openExpense: 30_00 });
    expect(calendar.totals).toEqual({ income: 276_48, expense: 12_00, openIncome: 0, openExpense: 9_99 + 30_00 });
    // Der naechste Abo-Termin (3.11.) liegt ausserhalb des Rasters
    expect(calendar.weeks.flat().filter((entry) => entry.entries.some((item) => item.title === "Streaming"))).toHaveLength(1);
  });
});
