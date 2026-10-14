import { describe, expect, it } from "vitest";
import { defaultFilter, filterToParams, matchesFilter, parseFilter, type FilterRow } from "./transaction-filter";

const MONTH = "2026-10";

const row = (overrides: Partial<FilterRow> & { status?: "booked" | "pending" } = {}): FilterRow => ({
  date: "2026-10-05",
  title: "Swapfiets Abo",
  kind: "expense",
  amountCents: 62_90,
  tx: { status: overrides.status ?? "booked", accountId: "giro", categoryId: "mob", note: "Kartenzahlung" },
  counterAccountId: null,
  ...overrides,
});

describe("Filter der Transaktionsliste", () => {
  it("liest und schreibt die Adresse ohne Standardwerte", () => {
    const filter = parseFilter({ q: "lidl", von: "2026-09-30", bis: "2026-10-13", art: "expense", min: "10", max: "50,5", konto: "ohne" }, MONTH);
    expect(filter).toMatchObject({ q: "lidl", period: "range", from: "2026-09-30", to: "2026-10-13", kind: "expense", account: "none", min: 10_00, max: 50_50 });
    expect(filterToParams(filter, MONTH).toString()).toBe("q=lidl&von=2026-09-30&bis=2026-10-13&art=expense&konto=ohne&min=10.00&max=50.50");
    expect(filterToParams(defaultFilter(MONTH), MONTH).toString()).toBe("");
    // Unsinn faellt auf den Standard zurueck
    expect(parseFilter({ monat: "2026-13", art: "x", von: "gestern" }, MONTH)).toEqual(defaultFilter(MONTH));
    // Alter Link mit Konto zeigt alle Monate
    expect(parseFilter({ konto: "giro" }, MONTH).period).toBe("all");
  });

  it("filtert nach Zeitraum, Betrag, Text und Betrag als Suchtext", () => {
    const filter = { ...defaultFilter(MONTH), period: "range", from: "2026-10-01", to: "2026-10-31" };
    expect(matchesFilter(row(), filter)).toBe(true);
    expect(matchesFilter(row({ date: "2026-09-30" }), filter)).toBe(false);
    expect(matchesFilter(row(), { ...filter, min: 70_00 })).toBe(false);
    expect(matchesFilter(row(), { ...filter, max: 62_90 })).toBe(true);
    expect(matchesFilter(row(), { ...filter, q: "karten" })).toBe(true);
    expect(matchesFilter(row(), { ...filter, q: "62,90" })).toBe(true);
    expect(matchesFilter(row(), { ...filter, q: "63" })).toBe(false);
  });

  it("findet Transfers ueber beide Konten", () => {
    const transfer = row({ kind: "transfer", counterAccountId: "rev", tx: { status: "booked", accountId: "giro", categoryId: null, note: null } });
    expect(matchesFilter(transfer, { ...defaultFilter(MONTH), account: "rev" })).toBe(true);
    expect(matchesFilter(transfer, { ...defaultFilter(MONTH), category: "none" })).toBe(false);
  });
});
