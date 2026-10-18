import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("Ziel nach der Anmeldung", () => {
  it("laesst nur interne Pfade zu", () => {
    expect(safeNextPath("/transaktionen?monat=alle")).toBe("/transaktionen?monat=alle");
    expect(safeNextPath("/?erfassen=ausgabe")).toBe("/?erfassen=ausgabe");
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\t/evil.com", "", undefined, ["/x"], `/${"a".repeat(600)}`]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});
