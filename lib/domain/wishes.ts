import { monthEnd, monthOf, type ISODate } from "./calendar";
import type { Cents, Transaction, Wish, WishPriority, WishStatus } from "./types";

/**
 * Wunschliste. Ein Wunsch zaehlt nirgends mit. Erst beim Einplanen entsteht
 * eine geplante Zahlung (Buchung mit status "pending"); nur diese geht in
 * "Aktuell verfuegbar" und die Prognose ein - so wird nichts doppelt gezaehlt.
 */

export type WishView = Wish & {
  /** Status unter Beruecksichtigung der verknuepften Zahlung. */
  effective: WishStatus;
  /** Termin der geplanten bzw. gebuchten Zahlung. */
  paymentDate: ISODate | null;
  paymentAccountId: string | null;
};

/**
 * Eingeplant heisst: es gibt eine offene Zahlung. Wurde sie als bezahlt
 * markiert, ist der Wunsch gekauft; wurde sie geloescht, ist er wieder nur
 * ein Wunsch.
 */
export function resolveWish(wish: Wish, transactionsById: Map<string, Transaction>): WishView {
  const tx = wish.transactionId ? transactionsById.get(wish.transactionId) : undefined;
  let effective = wish.status;
  if (wish.status === "planned") {
    if (!tx) effective = "idea";
    else if (tx.status === "booked") effective = "bought";
  }
  return { ...wish, effective, paymentDate: tx?.date ?? null, paymentAccountId: tx?.accountId ?? null };
}

const PRIORITY_ORDER: Record<WishPriority, number> = { high: 0, normal: 1, low: 2 };

/** Sortierung: eingeplant nach Zahltermin, Wuensche nach Prioritaet, dann Termin (offen zuletzt). */
export function compareWishes(a: WishView, b: WishView) {
  const dateA = a.paymentDate ?? a.targetDate;
  const dateB = b.paymentDate ?? b.targetDate;
  if (a.effective === "idea" && b.effective === "idea" && a.priority !== b.priority) {
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  }
  if (dateA !== dateB) {
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.localeCompare(dateB);
  }
  return a.title.localeCompare(b.title, "de");
}

export type WishGroup = { name: string; count: number; total: Cents; earliest: ISODate | null; planned: Cents };

export type WishSummary = {
  ideas: { count: number; total: Cents; undated: number; dueThisMonth: Cents };
  planned: { count: number; total: Cents; thisMonth: Cents };
  bought: { count: number; total: Cents };
  dropped: number;
  /** Offene Gruppen/Sparziele (Wuensche und Eingeplantes). */
  groups: WishGroup[];
};

export function wishSummary(wishes: WishView[], today: ISODate): WishSummary {
  const end = monthEnd(monthOf(today));
  const summary: WishSummary = {
    ideas: { count: 0, total: 0, undated: 0, dueThisMonth: 0 },
    planned: { count: 0, total: 0, thisMonth: 0 },
    bought: { count: 0, total: 0 },
    dropped: 0,
    groups: [],
  };
  const groups = new Map<string, WishGroup>();

  for (const wish of wishes) {
    if (wish.effective === "idea") {
      summary.ideas.count += 1;
      summary.ideas.total += wish.amountCents;
      if (!wish.targetDate) summary.ideas.undated += 1;
      else if (wish.targetDate <= end) summary.ideas.dueThisMonth += wish.amountCents;
    } else if (wish.effective === "planned") {
      summary.planned.count += 1;
      summary.planned.total += wish.amountCents;
      if (wish.paymentDate && wish.paymentDate <= end) summary.planned.thisMonth += wish.amountCents;
    } else if (wish.effective === "bought") {
      summary.bought.count += 1;
      summary.bought.total += wish.amountCents;
    } else {
      summary.dropped += 1;
    }

    if (wish.group && (wish.effective === "idea" || wish.effective === "planned")) {
      const group = groups.get(wish.group) ?? { name: wish.group, count: 0, total: 0, earliest: null, planned: 0 };
      const date = wish.paymentDate ?? wish.targetDate;
      group.count += 1;
      group.total += wish.amountCents;
      if (wish.effective === "planned") group.planned += wish.amountCents;
      if (date && (!group.earliest || date < group.earliest)) group.earliest = date;
      groups.set(wish.group, group);
    }
  }

  summary.groups = [...groups.values()].sort((a, b) => b.total - a.total);
  return summary;
}

/** Schluessel gegen doppelte Wuensche: Bezeichnung und Betrag. */
export function wishKey(title: string, amountCents: number) {
  return `${title.toLowerCase().replace(/[^a-z0-9äöüß]/g, "")}|${amountCents}`;
}
