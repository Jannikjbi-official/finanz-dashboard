/**
 * Formatierung fuer die Oberflaeche. Alle Betraege kommen als Cent.
 * Locale und Waehrung sind vorerst fest (de-DE, EUR) - die Nutzereinstellung
 * existiert bereits und wird hier spaeter durchgereicht.
 */

const LOCALE = "de-DE";
const CURRENCY = "EUR";

const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const moneyWhole = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });

/** "1.234,56 €" - mit `signed` immer mit Vorzeichen, mit `whole` ohne Cent. */
export function formatMoney(cents: number, options: { signed?: boolean; whole?: boolean } = {}) {
  const format = options.whole ? moneyWhole : money;
  const text = format.format(cents / 100);
  if (options.signed && cents > 0) return `+${text}`;
  // Typografisches Minus statt Bindestrich
  return text.replace("-", "−");
}

/** Betrag in Euro- und Cent-Teil zerlegt, fuer Darstellung mit kleineren Cent. */
export function moneyParts(cents: number, options: { signed?: boolean } = {}) {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const [whole, fraction] = number.format(abs / 100).split(",");
  const sign = negative ? "−" : options.signed && cents > 0 ? "+" : "";
  return { sign, whole, fraction, currency: "€" };
}

export function formatPercent(ratio: number, options: { signed?: boolean } = {}) {
  const text = percent.format(ratio).replace("-", "−").replace(/ /g, " ");
  return options.signed && ratio > 0 ? `+${text}` : text;
}

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const MONTHS_SHORT = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function split(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

/** "07.10.2026" */
export function formatDate(date: string) {
  const { year, month, day } = split(date);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

/** "15. Okt." */
export function formatDayShort(date: string) {
  const { month, day } = split(date);
  return `${day}. ${MONTHS_SHORT[month - 1]}`;
}

/** "Mi, 15. Okt." */
export function formatDayWithWeekday(date: string) {
  const { year, month, day } = split(date);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${day}. ${MONTHS_SHORT[month - 1]}`;
}

/** "15. Oktober 2026" */
export function formatDateLong(date: string) {
  const { year, month, day } = split(date);
  return `${day}. ${MONTHS[month - 1]} ${year}`;
}

/** "Oktober 2026" aus "2026-10" */
export function formatMonth(month: string, options: { short?: boolean } = {}) {
  const [year, m] = month.split("-").map(Number);
  return options.short ? `${MONTHS_SHORT[m - 1]} ${String(year).slice(2)}` : `${MONTHS[m - 1]} ${year}`;
}

export function monthName(month: string) {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

/** "in 3 Tagen", "heute", "morgen", "vor 2 Tagen" */
export function formatRelativeDays(days: number) {
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days === -1) return "gestern";
  return days > 0 ? `in ${days} Tagen` : `vor ${-days} Tagen`;
}

/** Zeitraum eines Ereignisses mit unscharfem Datum. */
export function formatWindow(from: string | null, to: string | null) {
  if (!from && !to) return "Termin offen";
  if (from && to && from !== to) {
    return from.slice(0, 7) === to.slice(0, 7)
      ? `${split(from).day}.–${formatDayShort(to)}`
      : `${formatDayShort(from)} – ${formatDayShort(to)}`;
  }
  if (from && !to) return `ab ${formatDayShort(from)}`;
  if (!from && to) return `bis ${formatDayShort(to)}`;
  return formatDayShort((from ?? to)!);
}
