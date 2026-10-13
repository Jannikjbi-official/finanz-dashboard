import { describe, expect, it } from "vitest";
import { compareWishes, resolveWish, wishSummary, type WishView } from "./domain/wishes";
import type { Transaction, Wish } from "./domain/types";
import { parseTable } from "./import";
import { groupFromNote, guessWishMapping, mapWishRows } from "./wish-import";

/** Gemischte Datei wie aus einer Haushaltsliste: Umsaetze und Geplantes zusammen (erfundene Werte). */
const MIXED = [
  "﻿Datum;Status;Typ;Kategorie;Beschreibung;Betrag (EUR);Konto;Notiz",
  "07.10.2026;Gebucht;Einnahme;Einkommen;Gehalt;1.035,54;Giro;",
  "12.10.2026;Gebucht;Ausgabe;Lebensmittel;Supermarkt;-30,92;Giro;",
  "02.10.2026;Gebucht;Umbuchung;Games;Aufladung Revolut;-50,00;Giro;",
  "13.10.2026;Vorgemerkt;Ausgabe;Sonstiges;Vorgemerkte Umsätze;-44,21;Giro;",
  "15.10.2026;Geplant;Ausgabe;Haushalt;Wäschekorb;-16,03;Giro;",
  "27.11.2026;Geplant;Ausgabe;Technik;Mikrofon;-398,00;Giro;Mikro-Sparziel, frühestens Black Friday",
  "27.11.2026;Geplant;Ausgabe;Technik;Mikrofonarm;-73,00;Giro;Mikro-Sparziel",
  "01.01.2027;Geplant;Ausgabe;Technik;Smartwatch;-319,99;Giro;Zeitpunkt offen",
].join("\r\n");

describe("Wunsch-Import", () => {
  it("waehlt in gemischten Dateien nur geplante Ausgaben vor", () => {
    const table = parseTable(MIXED);
    const mapping = guessWishMapping(table.header);
    expect(mapping).toMatchObject({ date: 0, status: 1, type: 2, category: 3, title: 4, amount: 5, note: 7 });

    const rows = mapWishRows(table, mapping);
    expect(rows.filter((row) => row.suggested).map((row) => row.title)).toEqual(["Wäschekorb", "Mikrofon", "Mikrofonarm", "Smartwatch"]);
    expect(rows.find((row) => row.title === "Gehalt")?.reason).toContain("Gebucht");
    expect(rows.find((row) => row.title === "Vorgemerkte Umsätze")?.reason).toContain("Vorgemerkt");
  });

  it("liest Preise ohne Vorzeichen, Gruppe aus der Notiz und offene Termine", () => {
    const rows = mapWishRows(parseTable(MIXED), guessWishMapping(parseTable(MIXED).header));
    const mic = rows.find((row) => row.title === "Mikrofon")!;
    expect(mic).toMatchObject({ amountCents: 398_00, targetDate: "2026-11-27", group: "Mikro-Sparziel", error: null });
    const watch = rows.find((row) => row.title === "Smartwatch")!;
    expect(watch).toMatchObject({ amountCents: 319_99, targetDate: null, dateOpen: true });
  });

  it("versteht einfache Wunschlisten mit Preis, Link und Prioritaet", () => {
    const csv = "Artikel,Preis,Link,Priorität,Gruppe\nKopfhörer,\"89,90\",https://example.org/k,hoch,\nKabel,12.50,keinlink,,Setup\n,5,,,\n";
    const table = parseTable(csv);
    const rows = mapWishRows(table, guessWishMapping(table.header));
    expect(rows[0]).toMatchObject({ title: "Kopfhörer", amountCents: 89_90, link: "https://example.org/k", priority: "high", targetDate: null, suggested: true });
    expect(rows[1]).toMatchObject({ amountCents: 12_50, link: null, group: "Setup", priority: "normal" });
    expect(rows[2].error).toBe("Bezeichnung fehlt");
  });

  it("erkennt Sparziele in Notizen", () => {
    expect(groupFromNote("SM-Sparziel, frühestens Black Friday")).toBe("SM-Sparziel");
    expect(groupFromNote("Sparziel: Gaming-PC")).toBe("Gaming-PC");
    expect(groupFromNote("Vorher Maß klären")).toBeNull();
  });
});

const wish = (overrides: Partial<Wish>): Wish => ({
  id: "w",
  title: "Wunsch",
  amountCents: 100_00,
  targetDate: null,
  status: "idea",
  priority: "normal",
  group: null,
  link: null,
  note: null,
  categoryId: null,
  transactionId: null,
  importId: null,
  ...overrides,
});

const payment = (overrides: Partial<Transaction>): Transaction => ({
  id: "t",
  type: "expense",
  status: "pending",
  amountCents: 100_00,
  date: "2026-10-20",
  title: "Wunsch",
  note: null,
  categoryId: null,
  accountId: "giro",
  transferGroupId: null,
  recurringId: null,
  recurringDue: null,
  ...overrides,
});

describe("Wunschliste", () => {
  it("leitet den Status aus der eingeplanten Zahlung ab", () => {
    const byId = new Map([
      ["open", payment({ id: "open" })],
      ["paid", payment({ id: "paid", status: "booked", date: "2026-10-12" })],
    ]);
    expect(resolveWish(wish({ status: "planned", transactionId: "open" }), byId)).toMatchObject({ effective: "planned", paymentDate: "2026-10-20" });
    expect(resolveWish(wish({ status: "planned", transactionId: "paid" }), byId).effective).toBe("bought");
    // Geplante Zahlung wurde geloescht: wieder nur ein Wunsch
    expect(resolveWish(wish({ status: "planned", transactionId: "weg" }), byId).effective).toBe("idea");
  });

  it("fasst Wuensche, Eingeplantes und Sparziele zusammen", () => {
    const byId = new Map([["p", payment({ id: "p", date: "2026-10-20", amountCents: 50_00 })]]);
    const list: WishView[] = [
      wish({ id: "a", amountCents: 398_00, targetDate: "2026-11-27", group: "Mikro" }),
      wish({ id: "b", amountCents: 73_00, targetDate: "2026-11-27", group: "Mikro" }),
      wish({ id: "c", amountCents: 20_00, targetDate: "2026-10-25" }),
      wish({ id: "d", amountCents: 319_99 }),
      wish({ id: "e", amountCents: 50_00, status: "planned", transactionId: "p", group: "Mikro" }),
      wish({ id: "f", amountCents: 9_00, status: "dropped" }),
    ].map((entry) => resolveWish(entry, byId));

    const summary = wishSummary(list, "2026-10-13");
    expect(summary.ideas).toEqual({ count: 4, total: 810_99, undated: 1, dueThisMonth: 20_00 });
    expect(summary.planned).toEqual({ count: 1, total: 50_00, thisMonth: 50_00 });
    expect(summary.dropped).toBe(1);
    expect(summary.groups).toEqual([{ name: "Mikro", count: 3, total: 521_00, earliest: "2026-10-20", planned: 50_00 }]);
  });

  it("sortiert wichtige Wuensche nach vorn und offene Termine nach hinten", () => {
    const list = [
      wish({ id: "1", title: "Offen" }),
      wish({ id: "2", title: "Spaeter", targetDate: "2026-12-01" }),
      wish({ id: "3", title: "Bald", targetDate: "2026-10-20" }),
      wish({ id: "4", title: "Wichtig", priority: "high", targetDate: "2027-01-01" }),
    ].map((entry) => resolveWish(entry, new Map()));
    expect(list.sort(compareWishes).map((entry) => entry.title)).toEqual(["Wichtig", "Bald", "Spaeter", "Offen"]);
  });
});
