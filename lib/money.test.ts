import { describe, expect, it } from "vitest";
import { parseAmountToCents } from "./money";

describe("parseAmountToCents", () => {
  it("versteht deutsche und englische Schreibweisen", () => {
    expect(parseAmountToCents("1.499")).toBe(149900);
    expect(parseAmountToCents("12.000")).toBe(1200000);
    expect(parseAmountToCents("1.234,56")).toBe(123456);
    expect(parseAmountToCents("12,5")).toBe(1250);
    expect(parseAmountToCents("12.50")).toBe(1250);
    expect(parseAmountToCents("19,99 €")).toBe(1999);
    expect(parseAmountToCents("0,01")).toBe(1);
  });

  it("weist Unsinn und negative Werte ab", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("-5")).toBeNull();
  });
});
