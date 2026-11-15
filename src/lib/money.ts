const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const euroCompact = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});
const euroRounded = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat("de-DE", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const percentPlain = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 0 });

/** 123456 → "1.234,56 €" */
export function formatCents(cents: number): string {
  return euro.format(cents / 100);
}

export function formatCentsRounded(cents: number): string {
  return euroRounded.format(cents / 100);
}

export function formatCentsCompact(cents: number): string {
  return euroCompact.format(cents / 100);
}

/** Euro (Kommazahl aus NumberField) → Cent-Integer */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

export function centsToEuros(cents: number): number {
  return cents / 100;
}

/** 0.123 → "+12 %" */
export function formatChange(ratio: number): string {
  return percent.format(ratio);
}

export function formatPercent(ratio: number): string {
  return percentPlain.format(ratio);
}

/** Relative Veränderung; null wenn keine Vergleichsbasis. */
export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous);
}

/** NumberField-Formatoptionen für Euro-Beträge */
export const EURO_FORMAT: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};
