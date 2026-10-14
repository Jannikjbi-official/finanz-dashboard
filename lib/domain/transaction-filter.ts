import { isISODate, isMonthKey, type ISODate } from "./calendar";
import type { Transaction } from "./types";
import { parseAmountToCents } from "../money";

/**
 * Filter der Transaktionsliste. Alle Werte stehen in der Adresse
 * (/transaktionen?monat=2026-10&q=lidl&min=10), damit Suchen teilbar sind und
 * "Zurueck" im Browser funktioniert.
 */
export type TransactionFilter = {
  q: string;
  /** "all", ein Monat ("2026-10") oder "range" fuer von/bis. */
  period: string;
  from: ISODate | null;
  to: ISODate | null;
  kind: "all" | "income" | "expense" | "transfer";
  status: "all" | "pending" | "booked";
  /** "all", "none" (ohne Konto) oder eine Konto-ID. */
  account: string;
  /** "all", "none" (ohne Kategorie) oder eine Kategorie-ID. */
  category: string;
  /** Betrag ab/bis in Cent (ohne Vorzeichen). */
  min: number | null;
  max: number | null;
};

export function defaultFilter(currentMonth: string): TransactionFilter {
  return { q: "", period: currentMonth, from: null, to: null, kind: "all", status: "all", account: "all", category: "all", min: null, max: null };
}

const KINDS = ["all", "income", "expense", "transfer"] as const;
const STATUSES = ["all", "pending", "booked"] as const;

function cents(value: string | undefined) {
  if (!value) return null;
  return parseAmountToCents(value.replace(".", ","));
}

/** Aus den Parametern der Adresse; Unbekanntes faellt auf den Standard zurueck. */
export function parseFilter(params: Record<string, string | undefined>, currentMonth: string): TransactionFilter {
  const base = defaultFilter(currentMonth);
  const from = params.von && isISODate(params.von) ? params.von : null;
  const to = params.bis && isISODate(params.bis) ? params.bis : null;
  let period = params.monat === "alle" ? "all" : params.monat && isMonthKey(params.monat) ? params.monat : base.period;
  if (from || to) period = "range";
  // Alter Link /transaktionen?konto=... zeigt alle Monate
  else if (!params.monat && params.konto) period = "all";

  return {
    q: (params.q ?? "").slice(0, 100),
    period,
    from,
    to,
    kind: (KINDS as readonly string[]).includes(params.art ?? "") ? (params.art as TransactionFilter["kind"]) : "all",
    status: (STATUSES as readonly string[]).includes(params.status ?? "") ? (params.status as TransactionFilter["status"]) : "all",
    account: params.konto === "ohne" ? "none" : params.konto || "all",
    category: params.kategorie === "ohne" ? "none" : params.kategorie || "all",
    min: cents(params.min),
    max: cents(params.max),
  };
}

/** Fuer die Adresse: nur, was vom Standard abweicht. */
export function filterToParams(filter: TransactionFilter, currentMonth: string): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.q.trim()) params.set("q", filter.q.trim());
  if (filter.period === "all") params.set("monat", "alle");
  else if (filter.period === "range") {
    if (filter.from) params.set("von", filter.from);
    if (filter.to) params.set("bis", filter.to);
    if (!filter.from && !filter.to) params.set("monat", "alle");
  } else if (filter.period !== currentMonth) params.set("monat", filter.period);
  if (filter.kind !== "all") params.set("art", filter.kind);
  if (filter.status !== "all") params.set("status", filter.status);
  if (filter.account !== "all") params.set("konto", filter.account === "none" ? "ohne" : filter.account);
  if (filter.category !== "all") params.set("kategorie", filter.category === "none" ? "ohne" : filter.category);
  if (filter.min !== null) params.set("min", (filter.min / 100).toFixed(2));
  if (filter.max !== null) params.set("max", (filter.max / 100).toFixed(2));
  return params;
}

export type FilterRow = {
  date: ISODate;
  title: string;
  kind: "income" | "expense" | "transfer";
  amountCents: number;
  tx: Pick<Transaction, "status" | "accountId" | "categoryId" | "note">;
  counterAccountId: string | null;
};

export function matchesFilter(row: FilterRow, filter: TransactionFilter): boolean {
  if (filter.period === "range") {
    if (filter.from && row.date < filter.from) return false;
    if (filter.to && row.date > filter.to) return false;
  } else if (filter.period !== "all" && row.date.slice(0, 7) !== filter.period) return false;

  if (filter.kind !== "all" && row.kind !== filter.kind) return false;
  if (filter.status !== "all" && row.tx.status !== filter.status) return false;
  if (filter.account === "none" && row.tx.accountId) return false;
  if (filter.account !== "all" && filter.account !== "none" && row.tx.accountId !== filter.account && row.counterAccountId !== filter.account) return false;
  if (filter.category === "none" && (row.tx.categoryId || row.kind === "transfer")) return false;
  if (filter.category !== "all" && filter.category !== "none" && row.tx.categoryId !== filter.category) return false;
  if (filter.min !== null && row.amountCents < filter.min) return false;
  if (filter.max !== null && row.amountCents > filter.max) return false;

  const needle = filter.q.trim().toLowerCase();
  if (needle) {
    const inText = `${row.title} ${row.tx.note ?? ""}`.toLowerCase().includes(needle);
    // "62,90" findet auch den Betrag
    const asAmount = /^\d+([.,]\d{1,2})?$/.test(needle) ? parseAmountToCents(needle.replace(".", ",")) : null;
    if (!inText && asAmount !== row.amountCents) return false;
  }
  return true;
}
