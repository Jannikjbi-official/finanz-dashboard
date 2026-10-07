import { describe, expect, it } from "vitest";
import {
  formatDayShort,
  formatDayWithWeekday,
  formatMoney,
  formatMonth,
  formatPercent,
  formatWindow,
  moneyParts,
} from "./format";

const nbsp = (text: string) => text.replace(/ /g, " ");

describe("Formatierung", () => {
  it("Betraege", () => {
    expect(nbsp(formatMoney(123456))).toBe("1.234,56 €");
    expect(nbsp(formatMoney(-500))).toBe("−5,00 €");
    expect(nbsp(formatMoney(500, { signed: true }))).toBe("+5,00 €");
    expect(nbsp(formatMoney(149900, { whole: true }))).toBe("1.499 €");
    expect(moneyParts(-123456)).toEqual({ sign: "−", whole: "1.234", fraction: "56", currency: "€" });
  });

  it("Daten", () => {
    expect(formatDayShort("2026-10-15")).toBe("15. Okt.");
    expect(formatDayWithWeekday("2026-10-07")).toBe("Mi, 7. Okt.");
    expect(formatMonth("2026-03")).toBe("März 2026");
    expect(formatMonth("2026-03", { short: true })).toBe("März 26");
    expect(formatWindow("2026-10-01", "2026-10-10")).toBe("1.–10. Okt.");
    expect(formatWindow(null, null)).toBe("Termin offen");
  });

  it("Prozent", () => {
    expect(formatPercent(0.31, { signed: true })).toBe("+31 %");
    expect(formatPercent(-0.05)).toBe("−5 %");
  });
});
