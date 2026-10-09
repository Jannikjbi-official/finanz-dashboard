/**
 * CSV schreiben (Export). Das Lesen beim Import steckt in lib/import.ts.
 */

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
