import { parseAmountToCents } from "./money";

export type CsvRow = {
  date: string;
  title: string;
  amountCents: number;
  type: "income" | "expense";
  category: string | null;
  note: string | null;
};

export type ParseResult = {
  rows: CsvRow[];
  errors: Array<{ line: number; reason: string; raw: string }>;
};

const SEPARATORS = [";", ",", "\t"];

/** Trennzeichen anhand der Kopfzeile raten. */
function detectSeparator(header: string) {
  let best = ";";
  let bestCount = 0;

  for (const separator of SEPARATORS) {
    const count = header.split(separator).length;
    if (count > bestCount) {
      best = separator;
      bestCount = count;
    }
  }

  return best;
}

/** Eine CSV-Zeile zerlegen, Anfuehrungszeichen beachtet. */
function splitLine(line: string, separator: string) {
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

/** "31.12.2026", "2026-12-31" oder "31/12/2026" -> ISO */
function normalizeDate(input: string): string | null {
  const value = input.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const german = value.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/);
  if (german) {
    const [, day, month, yearRaw] = german;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function headerIndex(cells: string[], names: string[]) {
  const lower = cells.map((cell) => cell.toLowerCase().replace(/^﻿/, ""));
  for (const name of names) {
    const index = lower.indexOf(name);
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * Erwartet eine Kopfzeile. Erkannt werden die Spalten Datum, Bezeichnung,
 * Betrag, Typ, Kategorie und Notiz - auch englisch benannt. Fehlt die
 * Typ-Spalte, entscheidet das Vorzeichen des Betrags.
 */
export function parseCsv(input: string): ParseResult {
  const text = input.replace(/^﻿/, "").trim();
  if (!text) return { rows: [], errors: [] };

  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { rows: [], errors: [] };

  const separator = detectSeparator(lines[0]);
  const header = splitLine(lines[0], separator);

  const columns = {
    date: headerIndex(header, ["datum", "date", "buchungstag"]),
    title: headerIndex(header, [
      "bezeichnung",
      "titel",
      "title",
      "beschreibung",
      "verwendungszweck",
      "description",
    ]),
    amount: headerIndex(header, ["betrag", "amount", "wert"]),
    type: headerIndex(header, ["typ", "type", "art"]),
    category: headerIndex(header, ["kategorie", "category"]),
    note: headerIndex(header, ["notiz", "note", "kommentar"]),
  };

  const rows: CsvRow[] = [];
  const errors: ParseResult["errors"] = [];

  if (columns.date === -1 || columns.amount === -1) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          reason: "Kopfzeile braucht mindestens die Spalten Datum und Betrag",
          raw: lines[0],
        },
      ],
    };
  }

  for (let index = 1; index < lines.length; index += 1) {
    const raw = lines[index];
    const cells = splitLine(raw, separator);

    const date = normalizeDate(cells[columns.date] ?? "");
    if (!date) {
      errors.push({ line: index + 1, reason: "Datum nicht lesbar", raw });
      continue;
    }

    const amountRaw = (cells[columns.amount] ?? "").replace(/[^\d,.\-+]/g, "");
    const negative = amountRaw.trim().startsWith("-");
    const amountCents = parseAmountToCents(amountRaw.replace(/^[-+]/, ""));

    if (amountCents === null || amountCents === 0) {
      errors.push({ line: index + 1, reason: "Betrag nicht lesbar", raw });
      continue;
    }

    const typeCell = (cells[columns.type] ?? "").toLowerCase();
    const type: "income" | "expense" = columns.type !== -1 && typeCell
      ? /einnahme|income|ein|\+/.test(typeCell)
        ? "income"
        : "expense"
      : negative
        ? "expense"
        : "income";

    const title = (cells[columns.title] ?? "").trim() || "Ohne Bezeichnung";

    rows.push({
      date,
      title: title.slice(0, 80),
      amountCents,
      type,
      category: (cells[columns.category] ?? "").trim() || null,
      note: (cells[columns.note] ?? "").trim() || null,
    });
  }

  return { rows, errors };
}

/**
 * Zelle fuer CSV aufbereiten. Werte, die mit = + - @ oder Tab beginnen,
 * wuerde Excel als Formel ausfuehren (CSV-Injection) - sie bekommen ein
 * fuehrendes Hochkomma.
 */
export function escapeCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return "";

  const header = Object.keys(rows[0]);
  const lines = [header.join(";")];

  for (const row of rows) {
    lines.push(header.map((key) => escapeCell(String(row[key] ?? ""))).join(";"));
  }

  // BOM, damit Excel die Umlaute richtig anzeigt
  return `﻿${lines.join("\r\n")}\r\n`;
}
