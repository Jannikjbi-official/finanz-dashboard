import { describe, expect, it } from "vitest";
import {
  defaultSelection,
  duplicateKey,
  guessMapping,
  mapRows,
  matchAccount,
  missingCategories,
  normalizeDate,
  parseSignedAmount,
  parseTable,
} from "./import";

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

  it("liest Status, Umbuchungen und Konto aus einem App-Export", () => {
    const csv = [
      "\uFEFFDatum;Status;Typ;Kategorie;Beschreibung;Betrag (EUR);Konto;Notiz",
      "07.10.2026;Gebucht;Einnahme;Einkommen;Stadtkasse;1.035,54;LzO Giro;",
      "02.10.2026;Gebucht;Umbuchung;Games;Aufladung Revolut;-50,00;LzO Giro;",
      "02.10.2026;Gebucht;Umbuchung;Games;Rückbuchung von Revolut;5,44;LzO Giro;",
      "13.10.2026;Vorgemerkt;Ausgabe;Sonstiges;Vorgemerkte Umsätze;-244,21;LzO Giro;",
      "15.10.2026;Geplant;Ausgabe;Haushalt;Wäschekorb;-16,03;LzO Giro;",
      "14.10.2026;Gebucht;Ausgabe;Lebensmittel;Bäcker;-3,50;LzO Giro;",
    ].join("\r\n");
    const table = parseTable(csv);
    const mapping = guessMapping(table.header);
    expect(mapping).toMatchObject({ date: 0, status: 1, type: 2, category: 3, title: 4, amount: 5, account: 6, note: 7 });

    const rows = mapRows(table, mapping, "2026-10-13");
    expect(rows.map((r) => [r.title, r.type, r.status, r.transfer, r.amountCents])).toEqual([
      ["Stadtkasse", "income", "booked", false, 103554],
      ["Aufladung Revolut", "expense", "booked", true, 5000],
      ["Rückbuchung von Revolut", "income", "booked", true, 544],
      ["Vorgemerkte Umsätze", "expense", "pending", false, 24421],
      ["Wäschekorb", "expense", "planned", false, 1603],
      // Gebucht, aber in der Zukunft: kann den heutigen Stand noch nicht veraendert haben
      ["Bäcker", "expense", "pending", false, 350],
    ]);
    expect(rows[0].account).toBe("LzO Giro");
  });

  it("waehlt Geplantes und Vorhandenes ab und zaehlt gleiche Zeilen einzeln", () => {
    const table = parseTable("Datum;Betrag;Titel;Status\n01.10.2026;-3,50;Bäcker;Gebucht\n01.10.2026;-3,50;Bäcker;Gebucht\n15.10.2026;-9;Plan;Geplant");
    const rows = mapRows(table, { date: 0, amount: 1, title: 2, status: 3 });
    const selection = defaultSelection(rows, [rows[0].key]);
    // Eine vorhandene Buchung deckt nur eine der beiden gleichen Zeilen ab
    expect([...selection.duplicates]).toEqual([2]);
    expect([...selection.excluded].sort()).toEqual([2, 4]);
  });

  it("ordnet Kontonamen zu und findet fehlende Kategorien", () => {
    const accounts = [
      { id: "g", name: "LzO Giro" },
      { id: "r", name: "Revolut" },
      { id: "a", name: "Alt", archived: true },
    ];
    expect(matchAccount("lzo giro", accounts)).toBe("g");
    expect(matchAccount("Revolut (Games)", accounts)).toBe("r");
    expect(matchAccount("Alt", accounts)).toBeNull();
    expect(matchAccount(null, accounts)).toBeNull();

    const rows = mapRows(parseTable("Datum;Betrag;Titel;Kategorie;Typ\n01.10.2026;-5;A;Bargeld;Ausgabe\n01.10.2026;-5;B;Lebensmittel;Ausgabe\n01.10.2026;-5;C;Games;Umbuchung"), {
      date: 0, amount: 1, title: 2, category: 3, type: 4,
    });
    expect(missingCategories(rows, [{ name: "Lebensmittel", kind: "expense" }])).toEqual(["Bargeld"]);
  });
});
