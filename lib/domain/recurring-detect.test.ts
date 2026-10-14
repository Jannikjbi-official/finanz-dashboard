import { describe, expect, it } from "vitest";
import { detectRecurring, suggestionKey } from "./recurring-detect";
import type { Recurring, Transaction } from "./types";

let n = 0;
const tx = (title: string, date: string, amountCents: number, overrides: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, type: "expense", status: "booked", amountCents, date, title, note: null, categoryId: null, accountId: "giro",
  transferGroupId: null, recurringId: null, recurringDue: null, ...overrides,
});

describe("Regelmaessige Zahlungen erkennen", () => {
  it("findet monatliche Zahlungen mit gleicher Bezeichnung und aehnlichem Betrag", () => {
    const list = [
      tx("Swapfiets Abo", "2026-08-05", 62_90),
      tx("Swapfiets Abo", "2026-09-04", 62_90),
      tx("Swapfiets Abo", "2026-10-05", 62_90),
      tx("Lidl Wilhelmshavener Heerstr.", "2026-10-01", 15_07),
      tx("Lidl Wilhelmshavener Heerstr.", "2026-10-06", 16_24),
      tx("Stadt Oldenburg, Abrechnung 09/2026", "2026-09-07", 1035_54, { type: "income" }),
      tx("Stadt Oldenburg, Abrechnung 10/2026", "2026-10-07", 1035_54, { type: "income" }),
    ];
    expect(detectRecurring(list, []).map((s) => [s.title, s.type, s.interval, s.amountCents, s.nextDue, s.count])).toEqual([
      ["Stadt Oldenburg, Abrechnung 10/2026", "income", "monthly", 1035_54, "2026-11-07", 2],
      ["Swapfiets Abo", "expense", "monthly", 62_90, "2026-11-05", 3],
    ]);
  });

  it("laesst Erfasstes, Zugeordnetes und Abgelehntes weg", () => {
    const list = [tx("Swapfiets Abo", "2026-09-05", 62_90), tx("Swapfiets Abo", "2026-10-05", 62_90)];
    const entry = { id: "r", type: "expense", title: "Swapfiets", provider: null, status: "active" } as Recurring;
    expect(detectRecurring(list, [entry])).toEqual([]);
    expect(detectRecurring(list, [], [suggestionKey("expense", "Swapfiets Abo")])).toEqual([]);
    expect(detectRecurring(list.map((t) => ({ ...t, recurringId: "r" })), [])).toEqual([]);
  });
});
