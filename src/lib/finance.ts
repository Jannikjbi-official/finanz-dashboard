import { type CalendarDate, endOfMonth, startOfMonth } from "@internationalized/date";
import { fromIso, withClampedDay } from "./dates";

export const PAYMENT_METHODS = [
  { id: "bar", label: "Bar" },
  { id: "karte", label: "Karte" },
  { id: "paypal", label: "PayPal" },
  { id: "ueberweisung", label: "Überweisung" },
] as const;
export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

export const INTERVALS = [
  { id: "woechentlich", label: "Wöchentlich", short: "Woche" },
  { id: "monatlich", label: "Monatlich", short: "Monat" },
  { id: "vierteljaehrlich", label: "Vierteljährlich", short: "Quartal" },
  { id: "jaehrlich", label: "Jährlich", short: "Jahr" },
] as const;
export type IntervalId = (typeof INTERVALS)[number]["id"];

export const SUBSCRIPTION_STATUS = [
  { id: "aktiv", label: "Aktiv", color: "success" },
  { id: "pausiert", label: "Pausiert", color: "warning" },
  { id: "gekuendigt", label: "Gekündigt", color: "default" },
] as const;
export type SubscriptionStatusId = (typeof SUBSCRIPTION_STATUS)[number]["id"];

export const PRIORITIES = [
  { id: "hoch", label: "Hoch", color: "danger", rank: 0 },
  { id: "mittel", label: "Mittel", color: "warning", rank: 1 },
  { id: "niedrig", label: "Niedrig", color: "default", rank: 2 },
] as const;
export type PriorityId = (typeof PRIORITIES)[number]["id"];

export const DEFAULT_INCOME_SOURCES = ["Gehalt", "Twitch", "Nebenjob", "Sonstiges"] as const;

export function labelOf<T extends { id: string; label: string }>(list: readonly T[], id: string): string {
  return list.find((x) => x.id === id)?.label ?? id;
}

/* ── Intervalle ───────────────────────────────────────────────────────────── */

const MONTHS_PER_INTERVAL: Record<Exclude<IntervalId, "woechentlich">, number> = {
  monatlich: 1,
  vierteljaehrlich: 3,
  jaehrlich: 12,
};

/** Umrechnung auf einen Monat (Cent, gerundet). */
export function perMonthCents(priceCents: number, interval: IntervalId): number {
  if (interval === "woechentlich") return Math.round((priceCents * 52) / 12);
  return Math.round(priceCents / MONTHS_PER_INTERVAL[interval]);
}

/** Umrechnung auf ein Jahr (Cent). */
export function perYearCents(priceCents: number, interval: IntervalId): number {
  if (interval === "woechentlich") return priceCents * 52;
  return priceCents * (12 / MONTHS_PER_INTERVAL[interval]);
}

/** Nächstes Datum nach `date` für eine Regel (monatliche Intervalle mit festem Tag). */
export function advanceDate(date: CalendarDate, interval: IntervalId, anchorDay: number): CalendarDate {
  if (interval === "woechentlich") return date.add({ weeks: 1 });
  const months = MONTHS_PER_INTERVAL[interval];
  return withClampedDay(startOfMonth(date).add({ months }), anchorDay);
}

/* ── Abo-Abbuchungen ──────────────────────────────────────────────────────── */

export interface SubscriptionLike {
  id: string;
  name: string;
  priceCents: number;
  interval: IntervalId;
  billingDay: number;
  startDate: string;
  status: SubscriptionStatusId;
  categoryId: string | null;
}

export interface Charge<T extends SubscriptionLike = SubscriptionLike> {
  date: string;
  subscription: T;
}

/** Erste Abbuchung am oder nach dem Startdatum. */
function firstCharge(sub: SubscriptionLike): CalendarDate {
  const start = fromIso(sub.startDate);
  if (sub.interval === "woechentlich") return start;
  const inStartMonth = withClampedDay(start, sub.billingDay);
  if (inStartMonth.compare(start) >= 0) return inStartMonth;
  return withClampedDay(startOfMonth(start).add({ months: 1 }), sub.billingDay);
}

/**
 * Alle Abbuchungen eines Abos im Zeitraum [from, to] (inklusive).
 * Nur aktive Abos buchen ab.
 */
export function chargesBetween<T extends SubscriptionLike>(
  sub: T,
  from: CalendarDate,
  to: CalendarDate,
): Charge<T>[] {
  if (sub.status !== "aktiv" || sub.priceCents <= 0) return [];
  const result: Charge<T>[] = [];
  let d = firstCharge(sub);
  if (d.compare(to) > 0) return result;

  // Schnell zum Zeitraum vorspulen
  if (d.compare(from) < 0) {
    if (sub.interval === "woechentlich") {
      const weeks = Math.floor(from.compare(d) / 7);
      d = d.add({ weeks });
    } else {
      const step = MONTHS_PER_INTERVAL[sub.interval];
      const monthsDiff = (from.year - d.year) * 12 + (from.month - d.month);
      const jumps = Math.max(0, Math.floor(monthsDiff / step) - 1);
      d = withClampedDay(startOfMonth(d).add({ months: jumps * step }), sub.billingDay);
    }
  }

  let guard = 0;
  while (d.compare(to) <= 0 && guard++ < 1000) {
    if (d.compare(from) >= 0) result.push({ date: d.toString(), subscription: sub });
    d = advanceDate(d, sub.interval, sub.billingDay);
  }
  return result;
}

export function chargesInMonth<T extends SubscriptionLike>(subs: T[], monthFirst: CalendarDate): Charge<T>[] {
  const from = startOfMonth(monthFirst);
  const to = endOfMonth(monthFirst);
  return subs
    .flatMap((s) => chargesBetween(s, from, to))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function nextChargeAfter<T extends SubscriptionLike>(sub: T, from: CalendarDate): string | null {
  const charges = chargesBetween(sub, from, from.add({ years: 1, days: 7 }));
  return charges[0]?.date ?? null;
}

/* ── Budgets ──────────────────────────────────────────────────────────────── */

export type BudgetLevel = "ok" | "warning" | "over";

export function budgetLevel(spentCents: number, budgetCents: number | null): BudgetLevel {
  if (!budgetCents || budgetCents <= 0) return "ok";
  const ratio = spentCents / budgetCents;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "warning";
  return "ok";
}

export function levelColor(level: BudgetLevel): "success" | "warning" | "danger" {
  return level === "over" ? "danger" : level === "warning" ? "warning" : "success";
}
