import { describe, expect, it } from "vitest";
import {
  firstOccurrenceFrom,
  monthlyAmount,
  nextOccurrence,
  occurrencesBetween,
  yearlyAmount,
} from "./schedule";

describe("schedule", () => {
  it("behaelt den Ankertag bei Monatsintervallen", () => {
    expect(
      occurrencesBetween("2026-01-31", "monthly", "2026-01-01", "2026-05-31"),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("findet den ersten Termin ab einem Stichtag", () => {
    expect(firstOccurrenceFrom("2024-01-31", "monthly", "2026-10-07")).toBe("2026-10-31");
    expect(firstOccurrenceFrom("2026-10-01", "weekly", "2026-10-07")).toBe("2026-10-08");
    expect(firstOccurrenceFrom("2026-10-08", "weekly", "2026-10-08")).toBe("2026-10-08");
    expect(firstOccurrenceFrom("2020-02-29", "yearly", "2026-01-01")).toBe("2026-02-28");
    expect(firstOccurrenceFrom("2030-01-01", "monthly", "2026-01-01")).toBe("2030-01-01");
  });

  it("listet Quartalstermine", () => {
    expect(
      occurrencesBetween("2026-01-15", "quarterly", "2026-03-01", "2026-12-31"),
    ).toEqual(["2026-04-15", "2026-07-15", "2026-10-15"]);
  });

  it("listet Wochentermine", () => {
    expect(
      occurrencesBetween("2026-10-01", "weekly", "2026-10-02", "2026-10-22"),
    ).toEqual(["2026-10-08", "2026-10-15", "2026-10-22"]);
  });

  it("naechster Termin nach einem Datum", () => {
    expect(nextOccurrence("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(nextOccurrence("2026-12-30", "weekly")).toBe("2027-01-06");
  });

  it("rechnet Betraege auf Monat und Jahr", () => {
    expect(monthlyAmount(1999, "monthly")).toBe(1999);
    expect(monthlyAmount(12000, "yearly")).toBe(1000);
    expect(yearlyAmount(1999, "monthly")).toBe(23988);
    expect(yearlyAmount(1000, "weekly")).toBe(52000);
  });
});
