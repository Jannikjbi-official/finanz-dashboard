import { describe, expect, it } from "vitest";
import { defaultReviewMonth, monthReview } from "./review";
import type { Category, Transaction } from "./types";

const food: Category = { id: "food", name: "Lebensmittel", kind: "expense", color: "#5f9e8f" };
const job: Category = { id: "job", name: "Gehalt", kind: "income", color: "#6f8fa8" };
let seq = 0;
const tx = (date: string, type: "income" | "expense", amountCents: number, overrides: Partial<Transaction> = {}): Transaction => ({
  id: `t${(seq += 1)}`, type, status: "booked", amountCents, date, title: `${type}-${seq}`, note: null, categoryId: type === "income" ? "job" : "food",
  accountId: "giro", transferGroupId: null, recurringId: null, recurringDue: null, ...overrides,
});

describe("Monatsrueckblick", () => {
  it("fasst einen abgeschlossenen Monat zusammen und vergleicht nur mit vollstaendigen Monaten", () => {
    const transactions = [
      tx("2026-08-01", "income", 1000_00),
      tx("2026-08-10", "expense", 400_00),
      tx("2026-09-01", "income", 1200_00),
      tx("2026-09-03", "expense", 9_99, { recurringId: "abo" }),
      tx("2026-09-05", "expense", 250_00),
      tx("2026-09-05", "expense", 40_01),
      tx("2026-09-20", "expense", 100_00, { transferGroupId: "g" }),
      tx("2026-09-25", "expense", 50_00, { status: "pending" }),
    ];
    const review = monthReview(transactions, [food, job], "2026-09", "2026-10-14");
    expect(review.running).toBe(false);
    expect(review.partialFrom).toBeNull();
    expect(review.summary).toMatchObject({ income: 1200_00, expense: 300_00, net: 900_00, fixed: 9_99 });
    expect(review.savingsRate).toBe(0.75);
    // August beginnt am 1. -> vollstaendig und vergleichbar
    expect(review.previousComparable).toBe(true);
    expect(review.baseline).toMatchObject({ months: ["2026-08"], averageExpense: 400_00 });
    expect(review.largest.map((entry) => entry.amountCents)).toEqual([250_00, 40_01, 9_99]);
    expect(review.recurringPaid).toEqual({ count: 1, total: 9_99 });
    expect(review.spendingDays).toBe(2);
    expect(review.expenseCategories.items[0]).toMatchObject({ id: "food", amount: 300_00 });
    expect(review.incomeCategories.items[0]).toMatchObject({ id: "job", amount: 1200_00 });
  });

  it("Datenbeginn mitten im Monat: als unvollstaendig gekennzeichnet, kein Vergleich", () => {
    const review = monthReview([tx("2026-09-30", "income", 278_48), tx("2026-10-05", "expense", 20_00)], [food, job], "2026-10", "2026-10-14");
    expect(review.running).toBe(true);
    expect(review.previousComparable).toBe(false);
    expect(monthReview([tx("2026-09-30", "income", 278_48)], [], "2026-09", "2026-10-14").partialFrom).toBe("2026-09-30");
    expect(defaultReviewMonth("2026-10-14")).toBe("2026-09");
  });
});
