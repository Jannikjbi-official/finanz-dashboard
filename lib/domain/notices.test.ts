import { describe, expect, it } from "vitest";
import { dueMessage, dueNotices, monthlyReview } from "./notices";
import type { Recurring, Transaction } from "./types";

const rec = (overrides: Partial<Recurring>): Recurring => ({
  id: "r", type: "expense", title: "YouTube Premium", provider: null, amountCents: 15_00, interval: "monthly",
  startDate: "2026-01-17", nextDue: "2026-10-17", status: "active", costType: "subscription", categoryId: null,
  accountId: "giro", endDate: null, cancelledOn: null, noticePeriod: null, note: null, ...overrides,
});

describe("Benachrichtigungen", () => {
  it("meldet Ueberfaelliges und die naechsten Tage, keine Einnahmen", () => {
    const notices = dueNotices([rec({}), rec({ id: "s", title: "Swapfiets", amountCents: 62_90, startDate: "2026-01-03", nextDue: "2026-10-03" }), rec({ id: "i", type: "income", title: "Rente", nextDue: "2026-10-15" }), rec({ id: "spaet", nextDue: "2026-10-30" })], "2026-10-14");
    expect(notices.map((n) => [n.title, n.date, n.overdue])).toEqual([
      ["Swapfiets", "2026-10-03", true],
      ["YouTube Premium", "2026-10-17", false],
    ]);
    expect(dueMessage(notices)).toBe("**Überfällig**\n• Swapfiets – 62,90 € (seit 03.10.)\n**Demnächst fällig**\n• YouTube Premium – 15,00 € am 17.10.");
  });

  it("fasst den Vormonat zusammen", () => {
    const tx = (type: "income" | "expense", amountCents: number, date: string): Transaction => ({
      id: `${type}${date}`, type, status: "booked", amountCents, date, title: "x", note: null, categoryId: null, accountId: "giro",
      transferGroupId: null, recurringId: null, recurringDue: null,
    });
    const review = monthlyReview([tx("income", 1098_58, "2026-10-07"), tx("expense", 280_64, "2026-10-12")], "2026-11-01");
    expect(review).toEqual({ month: "2026-10", text: "**Rückblick Oktober 2026**\nEinnahmen 1.098,58 € · Ausgaben 280,64 €\nÜberschuss 817,94 €" });
    expect(monthlyReview([], "2026-11-01")).toBeNull();
  });
});
