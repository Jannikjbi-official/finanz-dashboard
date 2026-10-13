import { describe, expect, it } from "vitest";
import { findRecurringMatches, scoreMatch, similarName } from "./matching";
import type { Recurring, Transaction } from "./types";

const rec = (overrides: Partial<Recurring>): Recurring => ({
  id: "r",
  type: "income",
  title: "Waisenrente",
  provider: null,
  amountCents: 276_48,
  interval: "monthly",
  startDate: "2026-01-30",
  nextDue: "2026-09-30",
  status: "active",
  costType: "other",
  categoryId: null,
  accountId: "giro",
  endDate: null,
  cancelledOn: null,
  noticePeriod: null,
  note: null,
  ...overrides,
});

let counter = 0;
const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: `t${++counter}`,
  type: "income",
  status: "booked",
  amountCents: 100_00,
  date: "2026-10-01",
  title: "Buchung",
  note: null,
  categoryId: null,
  accountId: "giro",
  transferGroupId: null,
  recurringId: null,
  recurringDue: null,
  ...overrides,
});

describe("Abgleich regelmaessiger Zahlungen", () => {
  it("erkennt aehnliche Namen", () => {
    expect(similarName("Waisenrente", "Renten Service")).toBe(true);
    expect(similarName("Swapfiets", "Swapfiets Abo")).toBe(true);
    expect(similarName("Grundsicherung", "Stadt Oldenburg, Abrechnung 10/2026")).toBe(false);
    expect(similarName("Stadt Oldenburg", "Stadt Oldenburg, Abrechnung 10/2026")).toBe(true);
  });

  it("ordnet eine Einnahme mit kleiner Abweichung und passendem Namen sicher zu", () => {
    const entry = rec({});
    const income = tx({ title: "Renten Service", amountCents: 278_48, date: "2026-09-30" });
    expect(scoreMatch(entry, "2026-09-30", income)).toMatchObject({ confidence: "sure", difference: 2_00, nameMatch: true });
  });

  it("schlaegt bei stark abweichendem Betrag nur vor - und nur mit passendem Anbieter", () => {
    const grundsicherung = rec({ id: "g", title: "Grundsicherung", amountCents: 563_00 });
    const stadt = tx({ title: "Stadt Oldenburg, Abrechnung 10/2026", amountCents: 1035_54, date: "2026-10-07" });
    expect(scoreMatch(grundsicherung, "2026-09-30", stadt)).toBeNull();
    expect(scoreMatch({ ...grundsicherung, provider: "Stadt Oldenburg" }, "2026-09-30", stadt)).toMatchObject({ confidence: "maybe", nameMatch: true });
  });

  it("beachtet Art, Konto, Zeitfenster, Transfers und schon zugeordnete Buchungen", () => {
    const entry = rec({});
    const base = { title: "Waisenrente", amountCents: 276_48, date: "2026-09-30" };
    expect(scoreMatch(entry, "2026-09-30", tx({ ...base, type: "expense" }))).toBeNull();
    expect(scoreMatch(entry, "2026-09-30", tx({ ...base, accountId: "anderes" }))).toBeNull();
    expect(scoreMatch(entry, "2026-09-30", tx({ ...base, date: "2026-10-11" }))).toBeNull();
    expect(scoreMatch(entry, "2026-09-30", tx({ ...base, transferGroupId: "x" }))).toBeNull();
    expect(scoreMatch(entry, "2026-09-30", tx({ ...base, recurringId: "r", recurringDue: "2026-08-30" }))).toBeNull();
    expect(scoreMatch(entry, "2026-09-30", tx({ ...base, status: "pending" }))).toBeNull();
    // Ohne Konto am Termin oder an der Buchung passt jedes Konto
    expect(scoreMatch({ ...entry, accountId: null }, "2026-09-30", tx({ ...base, accountId: "anderes" }))).not.toBeNull();
  });

  it("arbeitet Termine der Reihe nach ab und vergibt jede Buchung nur einmal", () => {
    const abo = rec({ id: "abo", type: "expense", title: "Swapfiets", amountCents: 62_90, startDate: "2026-08-03", nextDue: "2026-09-03" });
    const list = [
      tx({ id: "sep", type: "expense", title: "Swapfiets Abo", amountCents: 62_90, date: "2026-09-05" }),
      tx({ id: "okt", type: "expense", title: "Swapfiets Abo", amountCents: 62_90, date: "2026-10-05" }),
      tx({ id: "nov", type: "expense", title: "Swapfiets Abo", amountCents: 62_90, date: "2026-11-05" }),
    ];
    const matches = findRecurringMatches([abo], list, "2026-10-13");
    expect(matches.map((m) => [m.due, m.transaction.id, m.confidence])).toEqual([
      ["2026-09-03", "sep", "sure"],
      ["2026-10-03", "okt", "sure"],
    ]);
  });

  it("haelt nach einem unsicheren Vorschlag an", () => {
    const g = rec({ id: "g", title: "Grundsicherung", provider: "Stadt Oldenburg", amountCents: 563_00, nextDue: "2026-09-30" });
    const list = [
      tx({ id: "a", title: "Stadt Oldenburg", amountCents: 1035_54, date: "2026-10-07" }),
      tx({ id: "b", title: "Stadt Oldenburg", amountCents: 1035_54, date: "2026-10-30" }),
    ];
    expect(findRecurringMatches([g], list, "2026-10-31").map((m) => [m.due, m.transaction.id, m.confidence])).toEqual([["2026-09-30", "a", "maybe"]]);
  });

  it("gleicher Betrag ohne passenden Namen ist nur ein Vorschlag", () => {
    const abo = rec({ id: "yt", type: "expense", title: "YouTube Premium", amountCents: 15_00, nextDue: "2026-10-03" });
    const lidl = tx({ type: "expense", title: "Lidl Wilhelmshavener Heerstr.", amountCents: 15_00, date: "2026-10-01" });
    expect(scoreMatch(abo, "2026-10-03", lidl)).toMatchObject({ confidence: "maybe", nameMatch: false });
  });

  it("ignoriert pausierte Eintraege", () => {
    const paused = rec({ status: "paused" });
    expect(findRecurringMatches([paused], [tx({ title: "Waisenrente", amountCents: 276_48, date: "2026-09-30" })], "2026-10-13")).toEqual([]);
  });
});
