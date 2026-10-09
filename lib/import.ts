import { parseAmountToCents } from "./money";

/**
 * CSV-Import mit Spaltenzuordnung. Reine Logik ohne Datenbank - laeuft auf dem
 * Server fuer Vorschau und Uebernahme, ist aber auch im Test nutzbar.
 */

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export type ImportField = "date" | "title" | "amount" | "debit" | "credit" | "type" | "category" | "note";

export type ImportMapping = Partial<Record<ImportField, number>>;

export const FIELD_LABEL: Record<ImportField, string> = {
  date: "Datum",
  title: "Bezeichnung",
  amount: "Betrag (mit Vorzeichen)",
  debit: "Soll / Ausgang",
  credit: "Haben / Eingang",
  type: "Typ (Einnahme/Ausgabe)",
  category: "Kategorie",
  note: "Notiz / Verwendungszweck",
};

const SYNONYMS: Record<ImportField, string[]> = {
  date: ["datum", "date", "buchungstag", "buchungsdatum", "valuta", "wertstellung", "valutadatum"],
  title: [
    "bezeichnung", "titel", "title", "beschreibung", "empfänger", "empfaenger", "auftraggeber/empfänger",
    "beguenstigter/zahlungspflichtiger", "begünstigter/zahlungspflichtiger", "name zahlungsbeteiligter",
    "zahlungsempfänger", "payee", "description", "name",
  ],
  amount: ["betrag", "amount", "wert", "umsatz", "betrag (€)", "betrag (eur)", "betrag in eur"],
  debit: ["soll", "ausgang", "belastung", "debit"],
  credit: ["haben", "eingang", "gutschrift", "credit"],
  type: ["typ", "type", "art", "umsatzart"],
  category: ["kategorie", "category"],
  note: ["notiz", "note", "kommentar", "verwendungszweck", "buchungstext", "memo"],
};

const SEPARATORS = [";", ",", "\t"];

export type Table = {
  separator: string;
  header: string[];
  rows: string[][];
  /** Zeilennummer in der Datei je Datenzeile (fuer Fehlermeldungen). */
  lineNumbers: number[];
};

/** Trennzeichen raten: das, mit dem die ersten Zeilen gleich viele Spalten haben. */
function detectSeparator(lines: string[]) {
  let best = ";";
  let bestScore = -1;
  for (const separator of SEPARATORS) {
    const counts = lines.slice(0, 5).map((line) => splitLine(line, separator).length);
    const consistent = counts.every((count) => count === counts[0]);
    const score = counts[0] > 1 ? counts[0] * (consistent ? 2 : 1) : 0;
    if (score > bestScore) {
      best = separator;
      bestScore = score;
    }
  }
  return best;
}

export function splitLine(line: string, separator: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === separator && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/**
 * Tabelle lesen. Manche Banken schreiben Kontoinfos vor die Kopfzeile - die
 * Kopfzeile ist die erste Zeile, in der ein Datums- und ein Betragsfeld
 * erkannt werden.
 */
export function parseTable(input: string): Table {
  const text = input.replace(/^\uFEFF/, "");
  const all = text.split(/\r?\n/).map((value, index) => ({ value, number: index + 1 }));
  const lines = all.filter((line) => line.value.trim());
  if (lines.length === 0) return { separator: ";", header: [], rows: [], lineNumbers: [] };

  let headerIndex = 0;
  for (let index = 0; index < Math.min(lines.length, 15); index += 1) {
    const separator = detectSeparator(lines.slice(index).map((line) => line.value));
    const guess = guessMapping(splitLine(lines[index].value, separator));
    if (guess.date !== undefined && (guess.amount !== undefined || guess.debit !== undefined || guess.credit !== undefined)) {
      headerIndex = index;
      break;
    }
  }

  const body = lines.slice(headerIndex);
  const separator = detectSeparator(body.map((line) => line.value));
  return {
    separator,
    header: splitLine(body[0].value, separator),
    rows: body.slice(1).map((line) => splitLine(line.value, separator)),
    lineNumbers: body.slice(1).map((line) => line.number),
  };
}

export function guessMapping(header: string[]): ImportMapping {
  const lower = header.map((cell) => cell.toLowerCase().replace(/^﻿/, "").trim());
  const mapping: ImportMapping = {};
  const used = new Set<number>();

  for (const field of Object.keys(SYNONYMS) as ImportField[]) {
    for (const name of SYNONYMS[field]) {
      const index = lower.findIndex((cell, i) => !used.has(i) && cell === name);
      if (index !== -1) {
        mapping[field] = index;
        used.add(index);
        break;
      }
    }
  }
  // Zweiter Durchgang: Teiltreffer ("Buchungstag (Valuta)")
  for (const field of ["date", "amount", "title", "note"] as ImportField[]) {
    if (mapping[field] !== undefined) continue;
    const index = lower.findIndex((cell, i) => !used.has(i) && SYNONYMS[field].some((name) => cell.includes(name)));
    if (index !== -1) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

/** "31.12.2026", "31.12.26", "2026-12-31", "31/12/2026" -> ISO */
export function normalizeDate(input: string): string | null {
  const value = input.trim();
  let year: number;
  let month: number;
  let day: number;

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const german = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/);

  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (german) {
    [day, month] = [Number(german[1]), Number(german[2])];
    year = german[3].length === 2 ? 2000 + Number(german[3]) : Number(german[3]);
  } else return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** Betrag mit Vorzeichen in Cent: "-1.234,56", "1,234.56", "12,50 €", "(12,50)". */
export function parseSignedAmount(input: string): number | null {
  let value = input.trim().replace(/\s|€|EUR/gi, "");
  if (!value) return null;
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (/^[-−–]/.test(value)) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith("+")) value = value.slice(1);
  if (/-$/.test(value)) {
    // "12,50-" (manche Banken)
    negative = true;
    value = value.slice(0, -1);
  }

  // Englisches Format "1,234.56" erkennen: Punkt als letztes Trennzeichen mit 1-2 Nachkommastellen
  if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(value)) value = value.replace(/,/g, "");
  else if (/^\d+\.\d{1,2}$/.test(value)) {
    // "12.50" bleibt Dezimalpunkt
  } else value = value.replace(/\./g, "");

  const cents = parseAmountToCents(value);
  if (cents === null) return null;
  return negative ? -cents : cents;
}

export type ImportRow = {
  line: number;
  date: string | null;
  title: string;
  amountCents: number;
  type: "income" | "expense";
  category: string | null;
  note: string | null;
  error: string | null;
  key: string;
};

export function mapRows(table: Table, mapping: ImportMapping): ImportRow[] {
  const cell = (row: string[], field: ImportField) =>
    mapping[field] !== undefined ? (row[mapping[field]!] ?? "").trim() : "";

  return table.rows.slice(0, MAX_IMPORT_ROWS).map((row, index) => {
    const line = table.lineNumbers[index] ?? index + 2;
    const date = normalizeDate(cell(row, "date"));

    let signed: number | null = null;
    if (mapping.amount !== undefined) {
      signed = parseSignedAmount(cell(row, "amount"));
    } else {
      const debit = parseSignedAmount(cell(row, "debit"));
      const credit = parseSignedAmount(cell(row, "credit"));
      if (debit) signed = -Math.abs(debit);
      else if (credit) signed = Math.abs(credit);
    }

    const typeCell = cell(row, "type").toLowerCase();
    let type: "income" | "expense" = signed !== null && signed < 0 ? "expense" : "income";
    if (typeCell) {
      if (/einnahme|income|gutschrift|eingang|haben/.test(typeCell)) type = "income";
      else if (/ausgabe|expense|lastschrift|belastung|ausgang|soll/.test(typeCell)) type = "expense";
    }

    const note = cell(row, "note") || null;
    const title = (cell(row, "title") || note || "Ohne Bezeichnung").replace(/\s+/g, " ").slice(0, 80);
    const amountCents = signed === null ? 0 : Math.abs(signed);

    let error: string | null = null;
    if (!date) error = "Datum nicht lesbar";
    else if (signed === null) error = "Betrag nicht lesbar";
    else if (amountCents === 0) error = "Betrag ist 0";

    return {
      line,
      date,
      title,
      amountCents,
      type,
      category: cell(row, "category") || null,
      note: note && note !== title ? note.slice(0, 300) : null,
      error,
      key: date ? duplicateKey(date, type, amountCents, title) : "",
    };
  });
}

/** Schluessel fuer die Dublettenerkennung: gleicher Tag, Typ, Betrag und Titel. */
export function duplicateKey(date: string, type: string, amountCents: number, title: string) {
  return `${date}|${type}|${amountCents}|${title.toLowerCase().replace(/[^a-z0-9äöüß]/g, "")}`;
}

export function mappingProblems(mapping: ImportMapping): string[] {
  const problems: string[] = [];
  if (mapping.date === undefined) problems.push("Ordne eine Spalte als Datum zu.");
  if (mapping.amount === undefined && mapping.debit === undefined && mapping.credit === undefined) {
    problems.push("Ordne eine Betragsspalte zu – entweder einen Betrag mit Vorzeichen oder Soll/Haben.");
  }
  return problems;
}
