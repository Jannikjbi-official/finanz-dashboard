import { addDays, monthOf, shiftMonth, type ISODate } from "./calendar";
import { monthSummary } from "./ledger";
import { openDues } from "./recurring";
import type { Recurring, Transaction } from "./types";

/**
 * Inhalte fuer Benachrichtigungen (Discord). Reine Funktionen: was ist
 * faellig, was ist ueberfaellig, wie lief der Vormonat - und der Text dazu.
 */

export type DueNotice = { key: string; title: string; amountCents: number; date: ISODate; type: "income" | "expense"; overdue: boolean };

/** Offene Termine regelmaessiger Ausgaben: ueberfaellig oder in den naechsten `days` Tagen. */
export function dueNotices(recurring: Recurring[], today: ISODate, days = 3): DueNotice[] {
  const until = addDays(today, days);
  const list: DueNotice[] = [];
  for (const entry of recurring) {
    if (entry.type !== "expense") continue;
    for (const date of openDues(entry, until)) {
      list.push({ key: `${entry.id}:${date}`, title: entry.title, amountCents: entry.amountCents, date, type: entry.type, overdue: date < today });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const money = (cents: number) => euro.format(cents / 100).replace(/ /g, " ");
const day = (date: ISODate) => `${date.slice(8, 10)}.${date.slice(5, 7)}.`;

export function dueMessage(notices: DueNotice[]): string {
  const overdue = notices.filter((notice) => notice.overdue);
  const soon = notices.filter((notice) => !notice.overdue);
  const lines: string[] = [];
  if (overdue.length) {
    lines.push("**Überfällig**");
    for (const notice of overdue) lines.push(`• ${notice.title} – ${money(notice.amountCents)} (seit ${day(notice.date)})`);
  }
  if (soon.length) {
    lines.push("**Demnächst fällig**");
    for (const notice of soon) lines.push(`• ${notice.title} – ${money(notice.amountCents)} am ${day(notice.date)}`);
  }
  return lines.join("\n");
}

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Rueckblick auf den Vormonat (nur in den ersten Tagen eines Monats sinnvoll). */
export function monthlyReview(transactions: Transaction[], today: ISODate) {
  const month = shiftMonth(monthOf(today), -1);
  const summary = monthSummary(transactions, month);
  if (summary.count === 0) return null;
  const name = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
  const text = [
    `**Rückblick ${name}**`,
    `Einnahmen ${money(summary.income)} · Ausgaben ${money(summary.expense)}`,
    `${summary.net >= 0 ? "Überschuss" : "Fehlbetrag"} ${money(Math.abs(summary.net))}`,
  ].join("\n");
  return { month, text };
}
