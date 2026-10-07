import { describe, expect, it } from "vitest";
import { duplicateKey, guessMapping, mapRows, normalizeDate, parseSignedAmount, parseTable } from "./import";

describe("Import", () => {
  it("liest Betraege in verschiedenen Formaten", () => {
    expect(parseSignedAmount("-1.234,56")).toBe(-123456);
    expect(parseSignedAmount("1,234.56")).toBe(123456);
    expect(parseSignedAmount("12.50")).toBe(1250);
    expect(parseSignedAmount("12,50 €")).toBe(1250);
    expect(parseSignedAmount("(12,50)")).toBe(-1250);
    expect(parseSignedAmount("12,50-")).toBe(-1250);
    expect(parseSignedAmount("−3,00")).toBe(-300);
    expect(parseSignedAmount("abc")).toBeNull();
  });

  it("liest Daten und verwirft unmoegliche", () => {
    expect(normalizeDate("31.12.2026")).toBe("2026-12-31");
    expect(normalizeDate("1.2.26")).toBe("2026-02-01");
    expect(normalizeDate("2026-02-30")).toBeNull();
  });

  it("findet die Kopfzeile hinter Kontoinfos und ordnet Bankspalten zu", () => {
    const csv = [
      '"Kontonummer:";"DE00 1234"',
      '"Zeitraum:";"01.09.2026 - 30.09.2026"',
      "",
      '"Buchungstag";"Valuta";"Auftraggeber/Empfänger";"Verwendungszweck";"Soll";"Haben"',
      '"01.09.2026";"01.09.2026";"Arbeitgeber GmbH";"Gehalt September";"";"2.480,00"',
      '"03.09.2026";"03.09.2026";"Vermieter";"Miete";"890,00";""',
    ].join("\n");

    const table = parseTable(csv);
    expect(table.lineNumbers).toEqual([5, 6]);
    const mapping = guessMapping(table.header);
    expect(mapping).toMatchObject({ date: 0, title: 2, note: 3, debit: 4, credit: 5 });

    const rows = mapRows(table, mapping);
    expect(rows.map((r) => [r.line, r.date, r.title, r.type, r.amountCents])).toEqual([
      [5, "2026-09-01", "Arbeitgeber GmbH", "income", 248000],
      [6, "2026-09-03", "Vermieter", "expense", 89000],
    ]);
    expect(rows[0].note).toBe("Gehalt September");
  });

  it("meldet fehlerhafte Zeilen mit Zeilennummer", () => {
    const rows = mapRows(parseTable("Datum;Betrag;Titel\n32.01.2026;5;X\n01.01.2026;abc;Y\n01.01.2026;0;Z"), {
      date: 0,
      amount: 1,
      title: 2,
    });
    expect(rows.map((r) => [r.line, r.error])).toEqual([
      [2, "Datum nicht lesbar"],
      [3, "Betrag nicht lesbar"],
      [4, "Betrag ist 0"],
    ]);
  });

  it("bildet stabile Dubletten-Schluessel", () => {
    expect(duplicateKey("2026-01-01", "expense", 100, "REWE Markt 123")).toBe(
      duplicateKey("2026-01-01", "expense", 100, "rewe markt  123"),
    );
  });
});
