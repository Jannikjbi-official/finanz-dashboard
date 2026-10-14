import { describe, expect, it } from "vitest";
import { categoryBreakdown, categoryDetail, NO_CATEGORY, payeeKey } from "./categories";
import type { Category, Transaction } from "./types";

const food: Category = { id: "food", name: "Lebensmittel", kind: "expense", color: "#5f9e8f" };
const fun: Category = { id: "fun", name: "Freizeit", kind: "expense", color: "#8a84a8" };

let seq = 0;
const tx = (date: string, amountCents: number, categoryId: string | null, title = "Lidl", overrides: Partial<Transaction> = {}): Transaction => ({
  id: `t${(seq += 1)}`,
  type: "expense",
  status: "booked",
  amountCents,
  date,
  title,
  note: null,
  categoryId,
  accountId: "giro",
  transferGroupId: null,
  recurringId: null,
  recurringDue: null,
  ...overrides,
});

describe("Kategorien", () => {
  it("vergleicht den Monat mit dem Ø vollstaendiger Monate, ohne den angebrochenen Startmonat", () => {
    const transactions = [
      // Daten beginnen am 30.07. - Juli zaehlt nicht fuer den Durchschnitt
      tx("2026-07-30", 500_00, "food"),
      tx("2026-08-10", 100_00, "food"),
      tx("2026-09-12", 140_00, "food"),
      tx("2026-09-20", 60_00, "fun"),
      tx("2026-10-02", 90_00, "food"),
      tx("2026-10-03", 20_00, null, "Kiosk"),
      tx("2026-10-04", 15_00, "food", "Geplant", { status: "pending" }),
      tx("2026-10-05", 50_00, null, "Transfer", { transferGroupId: "g" }),
      tx("2026-10-06", 999_00, "food", "Erstattung", { type: "income" }),
    ];
    const result = categoryBreakdown(transactions, [food, fun], "2026-10");
    expect(result.averageMonths).toEqual(["2026-08", "2026-09"]);
    expect(result.total).toBe(110_00);
    expect(result.items).toEqual([
      { id: "food", name: "Lebensmittel", color: "#5f9e8f", amount: 90_00, count: 1, average: 120_00, share: 90 / 110 },
      { id: NO_CATEGORY, name: "Ohne Kategorie", color: null, amount: 20_00, count: 1, average: 0, share: 20 / 110 },
      // Nur frueher gebucht: erscheint mit 0 € und Durchschnitt
      { id: "fun", name: "Freizeit", color: "#8a84a8", amount: 0, count: 0, average: 30_00, share: 0 },
    ]);
  });

  it("ohne vollstaendigen Monat gibt es keinen Durchschnitt; geloeschte Kategorien zaehlen als ohne", () => {
    const result = categoryBreakdown([tx("2026-10-02", 10_00, "geloescht"), tx("2026-10-03", 5_00, null)], [food], "2026-10");
    expect(result.averageMonths).toEqual([]);
    expect(result.items).toEqual([{ id: NO_CATEGORY, name: "Ohne Kategorie", color: null, amount: 15_00, count: 2, average: null, share: 1 }]);
    expect(result.partialFrom).toBe("2026-10-02");
  });

  it("Detail: Verlauf ab Datenbeginn, Ø, haeufigste Empfaenger", () => {
    const transactions = [
      tx("2026-08-01", 30_00, "food", "LIDL Sagt Danke 4711"),
      tx("2026-08-15", 20_00, "food", "Lidl Wilhelmshavener Heerstr."),
      tx("2026-09-03", 45_00, "food", "Lidl Wilhelmshavener Heerstr."),
      tx("2026-09-04", 12_00, "food", "Bäcker Müller"),
      tx("2026-10-01", 8_00, "food", "Bäcker Müller"),
      tx("2026-10-20", 25_00, "food", "Lidl", { status: "pending" }),
      tx("2026-10-02", 70_00, "fun", "Kino"),
    ];
    const detail = categoryDetail(transactions, "food", "expense", "2026-10-14");
    expect(detail.history.map((month) => [month.month, month.amount, month.count])).toEqual([
      ["2026-08", 50_00, 2],
      ["2026-09", 57_00, 2],
      ["2026-10", 8_00, 1],
    ]);
    expect(detail.history[2].current).toBe(true);
    expect(detail.averageMonths).toEqual(["2026-08", "2026-09"]);
    expect(detail.average).toBe(53_50);
    expect(detail.yearTotal).toBe(115_00);
    expect(detail.payees).toEqual([
      { name: "Lidl Wilhelmshavener Heerstr.", amount: 95_00, count: 3, last: "2026-09-03" },
      { name: "Bäcker Müller", amount: 20_00, count: 2, last: "2026-10-01" },
    ]);
    // Geplante Buchungen stehen in der Liste, zaehlen aber nicht
    expect(detail.recent.map((entry) => entry.title)[0]).toBe("Lidl");
    expect(detail.recent).toHaveLength(6);
  });

  it("Haendler-Schluessel", () => {
    expect(payeeKey("LIDL Sagt Danke 4711")).toBe("lidl");
    expect(payeeKey("DM Drogerie 123")).toBe("dm drogerie");
    expect(payeeKey("12345")).toBe("12345");
  });
});
