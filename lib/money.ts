const currency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const compact = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatMoney(cents: number, opts?: { compact?: boolean }) {
  const value = cents / 100;
  return opts?.compact ? compact.format(value) : currency.format(value);
}

export function formatSigned(cents: number) {
  const sign = cents > 0 ? "+" : "";
  return `${sign}${formatMoney(cents)}`;
}

/** "1.234,56" oder "1234.56" -> Cent */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s|\u20AC/g, "");
  if (!cleaned) return null;

  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}

export function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

export const MONTH_NAMES = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
