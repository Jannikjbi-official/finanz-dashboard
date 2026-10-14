import { describe, expect, it } from "vitest";
import { amountChanges } from "./amount-changes";
import type { Recurring, Transaction } from "./types";

const rec: Recurring = {
  id: "w", type: "income", title: "Waisenrente", provider: null, amountCents: 276_48, interval: "monthly", startDate: "2026-01-30",
  nextDue: "2026-10-30", status: "active", costType: "other", categoryId: null, accountId: "giro", endDate: null, cancelledOn: null, noticePeriod: null, note: null,
};
const paid = (id: string, due: string, amountCents: number): Transaction => ({
  id, type: "income", status: "booked", amountCents, date: due, title: "Renten Service", note: null, categoryId: null, accountId: "giro",
  transferGroupId: null, recurringId: "w", recurringDue: due,
});

describe("Betragsaenderungen", () => {
  it("schlaegt den Betrag der zuletzt zugeordneten Zahlung vor", () => {
    const list = [paid("a", "2026-08-30", 276_48), paid("b", "2026-09-30", 278_48)];
    expect(amountChanges([rec], list)).toEqual([
      { recurringId: "w", title: "Waisenrente", type: "income", currentCents: 276_48, latestCents: 278_48, latestDate: "2026-09-30" },
    ]);
  });

  it("schweigt bei gleichem, schon gepruefem Betrag oder pausierten Eintraegen", () => {
    expect(amountChanges([rec], [paid("a", "2026-09-30", 276_48)])).toEqual([]);
    expect(amountChanges([{ ...rec, amountCheckedCents: 278_48 }], [paid("b", "2026-09-30", 278_48)])).toEqual([]);
    expect(amountChanges([{ ...rec, status: "paused" }], [paid("b", "2026-09-30", 278_48)])).toEqual([]);
  });
});
