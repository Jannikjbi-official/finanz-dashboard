import { describe, expect, it } from "vitest";
import { parseQuickEntry } from "./quick-parse";
import type { Account, Category } from "./types";

const accounts: Account[] = [
  { id: "spar", name: "Sparkonto", kind: "savings", startBalanceCents: 0, balanceAnchor: null, liquid: false, archived: false },
  { id: "giro", name: "LzO Giro", kind: "giro", startBalanceCents: 0, balanceAnchor: null, liquid: true, archived: false },
  { id: "rev", name: "Revolut", kind: "other", startBalanceCents: 0, balanceAnchor: null, liquid: true, archived: false },
];
const categories: Category[] = [
  { id: "food", name: "Lebensmittel", kind: "expense", color: "#000" },
  { id: "fun", name: "Freizeit", kind: "expense", color: "#000" },
  { id: "pay", name: "Gehalt", kind: "income", color: "#000" },
];
const context = { today: "2026-10-14", accounts, categories };

describe("Schnellerfassung", () => {
  it("liest Betrag, Datum, Konto und Kategorie", () => {
    expect(parseQuickEntry("-12,50 Lidl gestern @rev #leb", context)).toEqual({
      type: "expense", amountCents: 12_50, title: "Lidl", date: "2026-10-13", accountId: "rev", categoryId: "food", problems: [],
    });
  });

  it("erkennt Einnahmen, Tausenderpunkte und Daten ohne Jahr", () => {
    expect(parseQuickEntry("+1.035,54 Stadt Oldenburg 07.10.", context)).toMatchObject({
      type: "income", amountCents: 1035_54, title: "Stadt Oldenburg", date: "2026-10-07", accountId: "giro",
    });
    // 30.12. im Oktober liegt weit in der Zukunft: gemeint ist das Vorjahr
    expect(parseQuickEntry("5 Kino 30.12.", { ...context, today: "2027-01-05" }).date).toBe("2026-12-30");
  });

  it("nimmt ohne @ das Girokonto und erkennt Kategorien am ganzen Wort", () => {
    expect(parseQuickEntry("4,99 Freizeit Kino", context)).toMatchObject({ amountCents: 4_99, accountId: "giro", categoryId: "fun", title: "Freizeit Kino" });
    expect(parseQuickEntry("4.5 Eis", context).amountCents).toBe(4_50);
  });

  it("meldet, was fehlt", () => {
    expect(parseQuickEntry("Lidl @nix #gibtsnicht", context).problems).toEqual([
      "Kein Konto „nix“",
      "Keine Kategorie „gibtsnicht“",
      "Betrag fehlt",
    ]);
    expect(parseQuickEntry("12", context).problems).toEqual(["Beschreibung fehlt"]);
  });
});
