import { wishKey } from "./domain/wishes";
import type { WishPriority } from "./domain/types";
import { MAX_IMPORT_ROWS, normalizeDate, parseSignedAmount, type Table } from "./import";

/**
 * CSV-Import fuer die Wunschliste. Gleiche Dateiformate wie der Kontoimport
 * (Trennzeichen, Kopfzeile und Datum werden erkannt), aber eigene Spalten:
 * Preis, Wunschtermin, Gruppe/Sparziel, Link, Prioritaet.
 *
 * Enthaelt die Datei eine Status-Spalte (z. B. ein gemischter Export mit
 * Gebucht/Vorgemerkt/Geplant), sind nur die geplanten Zeilen vorausgewaehlt -
 * echte Umsaetze gehoeren in den Kontoimport.
 */

export type WishField = "title" | "amount" | "date" | "category" | "note" | "status" | "type" | "group" | "link" | "priority";
export type WishMapping = Partial<Record<WishField, number>>;

export const WISH_FIELD_LABEL: Record<WishField, string> = {
  title: "Bezeichnung",
  amount: "Preis / Betrag",
  date: "Wunschtermin",
  category: "Kategorie",
  note: "Notiz",
  status: "Status",
  type: "Typ",
  group: "Gruppe / Sparziel",
  link: "Link",
  priority: "Priorität",
};

const SYNONYMS: Record<WishField, string[]> = {
  title: ["bezeichnung", "titel", "title", "beschreibung", "artikel", "produkt", "wunsch", "name", "description"],
  amount: ["preis", "betrag", "kosten", "amount", "price", "betrag (eur)", "betrag (€)", "preis (eur)", "preis (€)"],
  date: ["datum", "termin", "wunschtermin", "zieldatum", "wann", "date", "frühestens", "geplant für"],
  category: ["kategorie", "category"],
  note: ["notiz", "note", "kommentar", "bemerkung", "anmerkung", "memo"],
  status: ["status"],
  type: ["typ", "type", "art"],
  group: ["gruppe", "sparziel", "ziel", "projekt", "group"],
  link: ["link", "url", "shop", "produktlink"],
  priority: ["priorität", "prioritaet", "prio", "priority", "wichtigkeit"],
};

export function guessWishMapping(header: string[]): WishMapping {
  const lower = header.map((cell) => cell.toLowerCase().replace(/^﻿/, "").trim());
  const mapping: WishMapping = {};
  const used = new Set<number>();
  const fields = Object.keys(SYNONYMS) as WishField[];

  for (const exact of [true, false]) {
    for (const field of fields) {
      if (mapping[field] !== undefined) continue;
      const index = lower.findIndex(
        (cell, i) => !used.has(i) && SYNONYMS[field].some((name) => (exact ? cell === name : cell.startsWith(name))),
      );
      if (index !== -1) {
        mapping[field] = index;
        used.add(index);
      }
    }
  }
  return mapping;
}

export type WishImportRow = {
  line: number;
  title: string;
  amountCents: number;
  targetDate: string | null;
  /** In der Datei stand ein Datum, laut Notiz ist der Zeitpunkt aber offen. */
  dateOpen: boolean;
  category: string | null;
  note: string | null;
  group: string | null;
  link: string | null;
  priority: WishPriority;
  /** Vorausgewaehlt? Nein bei gebuchten Umsaetzen, Einnahmen und Umbuchungen. */
  suggested: boolean;
  /** Warum nicht vorausgewaehlt. */
  reason: string | null;
  error: string | null;
  key: string;
};

const PLANNED_STATUS = /geplant|wunsch|idee|offen|plan|wish|todo/;
const BOOKED_STATUS = /gebucht|vorgemerkt|erledigt|gekauft|bezahlt|booked|pending/;
const NOT_A_PURCHASE = /einnahme|umbuchung|transfer|income|gutschrift/;
const OPEN_DATE = /zeitpunkt offen|termin offen|datum offen|irgendwann/i;

export function mapWishRows(table: Table, mapping: WishMapping): WishImportRow[] {
  const cell = (row: string[], field: WishField) => (mapping[field] !== undefined ? (row[mapping[field]!] ?? "").trim() : "");
  // Stehen Ausgaben mit Minus in der Datei, sind positive Betraege Einnahmen
  const signedFile = table.rows.some((row) => (parseSignedAmount(cell(row, "amount")) ?? 0) < 0);

  return table.rows.slice(0, MAX_IMPORT_ROWS).map((row, index) => {
    const line = table.lineNumbers[index] ?? index + 2;
    const note = cell(row, "note") || null;
    const title = (cell(row, "title") || "").replace(/\s+/g, " ").slice(0, 120);
    const signed = parseSignedAmount(cell(row, "amount"));
    const amountCents = signed === null ? 0 : Math.abs(signed);

    const rawDate = cell(row, "date");
    const parsedDate = rawDate ? normalizeDate(rawDate) : null;
    const dateOpen = Boolean(parsedDate && note && OPEN_DATE.test(note));

    const status = cell(row, "status").toLowerCase();
    const type = cell(row, "type").toLowerCase();
    let reason: string | null = null;
    if (status && BOOKED_STATUS.test(status) && !PLANNED_STATUS.test(status)) {
      reason = `Status „${cell(row, "status")}“ – echte Umsätze gehören in den Kontoimport`;
    } else if (type && NOT_A_PURCHASE.test(type)) {
      reason = `Typ „${cell(row, "type")}“ ist kein Kauf`;
    } else if (signedFile && signed !== null && signed > 0) {
      reason = "Positiver Betrag – sieht nach einer Einnahme aus";
    }

    let error: string | null = null;
    if (!title) error = "Bezeichnung fehlt";
    else if (signed === null) error = "Preis nicht lesbar";
    else if (amountCents === 0) error = "Preis ist 0";
    else if (rawDate && !parsedDate) error = "Datum nicht lesbar";

    return {
      line,
      title,
      amountCents,
      targetDate: dateOpen ? null : parsedDate,
      dateOpen,
      category: cell(row, "category") || null,
      note: note ? note.slice(0, 500) : null,
      group: (cell(row, "group") || groupFromNote(note))?.slice(0, 60) ?? null,
      link: toLink(cell(row, "link")),
      priority: toPriority(cell(row, "priority")),
      suggested: !error && !reason,
      reason,
      error,
      key: wishKey(title, amountCents),
    };
  });
}

/** "SM7B-Sparziel, frühestens Black Friday" -> "SM7B-Sparziel" */
export function groupFromNote(note: string | null): string | null {
  if (!note) return null;
  const match = note.match(/([^\s,;]+-Sparziel)/i) ?? note.match(/Sparziel[:\s]+([^,;]+)/i);
  return match ? match[1].trim() : null;
}

function toLink(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

function toPriority(value: string): WishPriority {
  const text = value.toLowerCase();
  if (/hoch|wichtig|high|muss|^1$/.test(text)) return "high";
  if (/niedrig|später|spaeter|low|irgendwann|^3$/.test(text)) return "low";
  return "normal";
}

export function wishMappingProblems(mapping: WishMapping): string[] {
  const problems: string[] = [];
  if (mapping.title === undefined) problems.push("Ordne eine Spalte als Bezeichnung zu.");
  if (mapping.amount === undefined) problems.push("Ordne eine Spalte als Preis zu.");
  return problems;
}
