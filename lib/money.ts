/**
 * Betrag aus einem Eingabefeld in Cent: "1.234,56", "1234.56", "1.499" oder
 * "19,99 €". Negative Werte werden abgelehnt - das Vorzeichen ergibt sich aus
 * dem Typ (Einnahme/Ausgabe). Formatierung fuer die Anzeige: lib/format.ts.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s|€/g, "");
  if (!cleaned) return null;

  // "1.499" oder "12.000" sind deutsche Tausenderpunkte, kein Dezimalpunkt
  const thousandsOnly = /^\d{1,3}(\.\d{3})+$/.test(cleaned);

  const normalized = thousandsOnly
    ? cleaned.replace(/\./g, "")
    : cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}
