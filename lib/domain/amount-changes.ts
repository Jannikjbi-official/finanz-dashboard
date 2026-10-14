import type { Cents, ISODate, Recurring, Transaction } from "./types";

/**
 * Betragsaenderungen erkennen: Die zuletzt zugeordnete Zahlung einer
 * regelmaessigen Zahlung hat einen anderen Betrag als hinterlegt (Preis-
 * erhoehung, Rentenanpassung). Vorschlag: Betrag uebernehmen oder bewusst
 * beibehalten - die Entscheidung merkt sich `amountCheckedCents`, damit
 * derselbe Betrag nicht erneut vorgeschlagen wird.
 */
export type AmountChange = {
  recurringId: string;
  title: string;
  type: Recurring["type"];
  currentCents: Cents;
  latestCents: Cents;
  latestDate: ISODate;
};

export function amountChanges(recurring: Array<Recurring & { amountCheckedCents?: number | null }>, transactions: Transaction[]): AmountChange[] {
  const latest = new Map<string, Transaction>();
  for (const tx of transactions) {
    if (tx.status !== "booked" || !tx.recurringId || !tx.recurringDue) continue;
    const known = latest.get(tx.recurringId);
    if (!known || tx.recurringDue > known.recurringDue!) latest.set(tx.recurringId, tx);
  }

  const result: AmountChange[] = [];
  for (const entry of recurring) {
    if (entry.status !== "active") continue;
    const tx = latest.get(entry.id);
    if (!tx || tx.amountCents === entry.amountCents || tx.amountCents === entry.amountCheckedCents) continue;
    result.push({ recurringId: entry.id, title: entry.title, type: entry.type, currentCents: entry.amountCents, latestCents: tx.amountCents, latestDate: tx.date });
  }
  return result;
}
