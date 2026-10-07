import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  isISODate,
  monthEnd,
  monthsUntil,
  shiftMonth,
  todayIn,
} from "./calendar";

describe("calendar", () => {
  it("kappt Monatsenden statt ueberzulaufen", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("rechnet Tage ueber Sommerzeitwechsel korrekt", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-12-31", "2026-01-01")).toBe(-364);
  });

  it("bestimmt heute in der Zeitzone des Nutzers", () => {
    // 23:30 UTC ist in Berlin schon der naechste Tag
    const lateUtc = new Date("2026-10-07T23:30:00Z");
    expect(todayIn("Europe/Berlin", lateUtc)).toBe("2026-10-08");
    expect(todayIn("UTC", lateUtc)).toBe("2026-10-07");
  });

  it("validiert Datumsangaben streng", () => {
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-1-01")).toBe(false);
  });

  it("verschiebt Monate", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(monthsUntil("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});
