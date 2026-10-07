import { describe, expect, it } from "vitest";
import { correctedDue } from "./index";

describe("004-recurring-drift", () => {
  it("holt verrutschte Termine auf den Monatsletzten zurueck", () => {
    // Bug: 31.01. + 1 Monat ergab 03.03.
    expect(correctedDue("2026-01-31", "monthly", "2026-03-03")).toBe("2026-02-28");
    expect(correctedDue("2026-01-31", "monthly", "2026-05-01")).toBe("2026-04-30");
  });

  it("laesst korrekte Termine unveraendert", () => {
    expect(correctedDue("2026-01-31", "monthly", "2026-02-28")).toBe("2026-02-28");
    expect(correctedDue("2026-01-15", "monthly", "2026-10-15")).toBe("2026-10-15");
    expect(correctedDue("2026-01-15", "weekly", "2026-10-16")).toBe("2026-10-16");
  });

  it("setzt weit abweichende Termine auf den naechsten planmaessigen", () => {
    expect(correctedDue("2026-01-15", "monthly", "2026-10-20")).toBe("2026-11-15");
  });
});
