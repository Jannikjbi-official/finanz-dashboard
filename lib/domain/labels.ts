import type { AccountKind, CostType, Interval, RecurringStatus } from "./types";

/** Deutsche Bezeichnungen fuer Aufzaehlungen - an einer Stelle. */

export const INTERVAL_LABEL: Record<Interval, string> = {
  weekly: "Wöchentlich",
  monthly: "Monatlich",
  quarterly: "Quartalsweise",
  yearly: "Jährlich",
};

/** Kurzform hinter Betraegen: "12,99 € / Monat". */
export const INTERVAL_UNIT: Record<Interval, string> = {
  weekly: "Woche",
  monthly: "Monat",
  quarterly: "Quartal",
  yearly: "Jahr",
};

export const COST_TYPE_LABEL: Record<CostType, string> = {
  rent: "Miete & Wohnen",
  energy: "Strom & Energie",
  internet: "Internet",
  phone: "Handy",
  insurance: "Versicherungen",
  subscription: "Abonnements",
  loan: "Kredite & Raten",
  other: "Sonstiges",
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  giro: "Girokonto",
  savings: "Sparkonto",
  cash: "Bargeld",
  paypal: "PayPal",
  other: "Sonstiges Konto",
};

export const RECURRING_STATUS_LABEL: Record<RecurringStatus, string> = {
  active: "Aktiv",
  paused: "Pausiert",
  cancelled: "Gekündigt",
  archived: "Archiviert",
};

/**
 * Einordnung von Altdaten ohne Kostenart anhand des Namens. Wird nur genutzt,
 * solange keine Kostenart gespeichert ist - jede Zuordnung laesst sich in der
 * Oberflaeche aendern.
 */
const COST_TYPE_HINTS: Array<[CostType, RegExp]> = [
  ["rent", /miete|nebenkosten|wohnung|hausgeld|kaltmiete|warmmiete/i],
  ["energy", /strom|gas\b|energie|fernwärme|heizung|stadtwerke/i],
  ["internet", /internet|dsl|glasfaser|kabel|vodafone kabel|router/i],
  ["phone", /handy|mobilfunk|telefon|smartphone|sim\b|tarif/i],
  ["insurance", /versicherung|haftpflicht|hausrat|krankenkasse|kfz|allianz|huk|ergo|axa/i],
  ["loan", /kredit|darlehen|rate\b|finanzierung|leasing|klarna/i],
  [
    "subscription",
    /abo|netflix|spotify|disney|prime|amazon|youtube|apple|icloud|google|microsoft|office|adobe|dazn|sky|audible|chatgpt|openai|claude|patreon|twitch|xbox|playstation|nintendo|steam|github|notion|dropbox|zeitung|magazin|fitness|gym|mcfit|urban sports/i,
  ],
];

export function inferCostType(title: string): CostType {
  for (const [costType, pattern] of COST_TYPE_HINTS) {
    if (pattern.test(title)) return costType;
  }
  return "other";
}
