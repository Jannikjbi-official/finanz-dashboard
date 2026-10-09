import { describe, expect, it } from "vitest";
import { escapeCell, toCsv } from "./csv";

describe("CSV-Export", () => {
  it("entschaerft Formeln (CSV-Injection)", () => {
    expect(escapeCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(escapeCell("+49 123")).toBe("'+49 123");
    expect(escapeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCell("Miete")).toBe("Miete");
  });

  it("schreibt Semikolon-CSV mit BOM", () => {
    expect(toCsv([{ Datum: "01.10.2026", Notiz: "a;b" }])).toBe("﻿Datum;Notiz\r\n01.10.2026;\"a;b\"\r\n");
  });
});
