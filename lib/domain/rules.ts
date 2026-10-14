import type { TxType } from "./types";

/**
 * Regeln fuer die automatische Kategorisierung: "enthaelt Lidl ->
 * Lebensmittel". Geprueft werden Bezeichnung und Notiz, ohne Gross-/
 * Kleinschreibung. Die erste passende Regel (nach Reihenfolge) gewinnt; sie
 * greift nur bei Buchungen ohne Kategorie und nie bei Transfers.
 */
export type CategoryRule = {
  id: string;
  /** Text, der in Bezeichnung oder Notiz vorkommen muss. */
  match: string;
  categoryId: string;
  /** Nur fuer diese Art; null = beide. */
  kind: TxType | null;
  /** Nur fuer dieses Konto; null = alle. */
  accountId: string | null;
  order: number;
};

type Target = { title: string; note?: string | null; type: TxType; accountId?: string | null };

export function ruleMatches(rule: CategoryRule, tx: Target) {
  if (rule.kind && rule.kind !== tx.type) return false;
  if (rule.accountId && rule.accountId !== tx.accountId) return false;
  const needle = rule.match.trim().toLowerCase();
  if (!needle) return false;
  return `${tx.title} ${tx.note ?? ""}`.toLowerCase().includes(needle);
}

export function categorize(tx: Target, rules: CategoryRule[]): string | null {
  const sorted = [...rules].sort((a, b) => a.order - b.order);
  return sorted.find((rule) => ruleMatches(rule, tx))?.categoryId ?? null;
}
