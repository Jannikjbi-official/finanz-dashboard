import { daysInMonth, monthEnd, monthOf, monthStart, shiftMonth, type ISODate, type MonthKey } from "./calendar";
import type { Account, Cents, Transaction } from "./types";

/**
 * Buchungen, Kontostaende und Monatsauswertungen.
 *
 * Regeln:
 * - Nur gebuchte Buchungen (status "booked") veraendern Kontostaende.
 * - Transfers (transferGroupId) veraendern Kontostaende, zaehlen aber nie
 *   als Einnahme oder Ausgabe.
 */

export function isTransfer(tx: Pick<Transaction, "transferGroupId">) {
  return Boolean(tx.transferGroupId);
}

export function signedAmount(tx: Pick<Transaction, "type" | "amountCents">): Cents {
  return tx.type === "income" ? tx.amountCents : -tx.amountCents;
}

type BalanceBase = Pick<Account, "id" | "startBalanceCents"> & { balanceAnchor?: Account["balanceAnchor"] };

const booked = (tx: Transaction, accountId: string) => tx.status === "booked" && tx.accountId === accountId;

/**
 * Saldo vor der ersten Buchung. Mit Kontostand-Anker wird er aus dem Anker
 * zurueckgerechnet (Anker minus alle Buchungen bis einschliesslich Ankertag),
 * sonst ist es der eingegebene Anfangssaldo.
 */
export function openingBalance(account: BalanceBase, transactions: Transaction[]): Cents {
  const anchor = account.balanceAnchor;
  if (!anchor) return account.startBalanceCents;
  let balance = anchor.amountCents;
  for (const tx of transactions) {
    if (booked(tx, account.id) && tx.date <= anchor.date) balance -= signedAmount(tx);
  }
  return balance;
}

/**
 * Kontostand: Saldo vor der ersten Buchung plus alle gebuchten Bewegungen bis
 * einschliesslich `asOf` (ohne Angabe: alle). Buchungen mit spaeterem Datum
 * aendern den heutigen Stand nicht.
 */
export function accountBalance(account: BalanceBase, transactions: Transaction[], asOf?: ISODate): Cents {
  let balance = openingBalance(account, transactions);
  for (const tx of transactions) {
    if (booked(tx, account.id) && (!asOf || tx.date <= asOf)) balance += signedAmount(tx);
  }
  return balance;
}

export function accountBalances(accounts: BalanceBase[], transactions: Transaction[], asOf?: ISODate): Map<string, Cents> {
  return new Map(accounts.map((account) => [account.id, accountBalance(account, transactions, asOf)]));
}

/** Konten, deren Guthaben als verfuegbar gilt (liquide, nicht archiviert). */
export function liquidAccountIds(accounts: Account[]) {
  return new Set(accounts.filter((account) => account.liquid && !account.archived).map((account) => account.id));
}

export type AccountEntry = { tx: Transaction; balanceAfter: Cents };

/** Kontoverlauf, neueste zuerst, mit Saldo nach jeder Buchung. */
export function accountHistory(account: Account, transactions: Transaction[]): AccountEntry[] {
  const own = transactions
    .filter((tx) => booked(tx, account.id))
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));

  let balance = openingBalance(account, transactions);
  const entries = own.map((tx) => {
    balance += signedAmount(tx);
    return { tx, balanceAfter: balance };
  });
  return entries.reverse();
}

export type MonthSummary = {
  month: MonthKey;
  income: Cents;
  expense: Cents;
  /** Ausgaben aus regelmaessigen Zahlungen (Abos, feste Kosten). */
  fixed: Cents;
  variable: Cents;
  net: Cents;
  /** Anzahl gebuchter Einnahmen/Ausgaben (ohne Transfers). */
  count: number;
};

/** Gebuchte Einnahmen und Ausgaben eines Monats, ohne Transfers. */
export function monthSummary(transactions: Transaction[], month: MonthKey): MonthSummary {
  const from = monthStart(month);
  const to = monthEnd(month);
  const summary: MonthSummary = { month, income: 0, expense: 0, fixed: 0, variable: 0, net: 0, count: 0 };

  for (const tx of transactions) {
    if (tx.status !== "booked" || isTransfer(tx) || tx.date < from || tx.date > to) continue;
    summary.count += 1;
    if (tx.type === "income") {
      summary.income += tx.amountCents;
    } else {
      summary.expense += tx.amountCents;
      if (tx.recurringId) summary.fixed += tx.amountCents;
      else summary.variable += tx.amountCents;
    }
  }
  summary.net = summary.income - summary.expense;
  return summary;
}

/**
 * Einnahmen/Ausgaben der letzten `count` Monate bis `until`. Monate vor der
 * ersten erfassten Buchung werden weggelassen - es werden keine leeren
 * Monate vorgetaeuscht.
 */
export function monthlyHistory(transactions: Transaction[], until: MonthKey, count = 12): MonthSummary[] {
  const months = Array.from({ length: count }, (_, index) => shiftMonth(until, index - (count - 1)));
  const summaries = months.map((month) => monthSummary(transactions, month));
  const first = summaries.findIndex((summary) => summary.count > 0);
  return first === -1 ? [] : summaries.slice(first);
}

export type SpendingBaseline = {
  /** Abgeschlossene Monate mit Daten, die eingeflossen sind. */
  months: MonthKey[];
  averageExpense: Cents;
  averageVariable: Cents;
  /** Variable Ausgaben pro Kalendertag, fuer die Restmonats-Schaetzung. */
  variablePerDay: number;
};

/**
 * Durchschnitt der letzten bis zu `count` abgeschlossenen Monate, in denen
 * ueberhaupt gebucht wurde. Null, wenn es noch keinen solchen Monat gibt.
 */
export function spendingBaseline(transactions: Transaction[], today: ISODate, count = 3): SpendingBaseline | null {
  const current = monthOf(today);
  const used: MonthSummary[] = [];

  for (let offset = 1; offset <= 24 && used.length < count; offset += 1) {
    const summary = monthSummary(transactions, shiftMonth(current, -offset));
    if (summary.count > 0) used.push(summary);
  }
  if (used.length === 0) return null;

  const days = used.reduce((sum, summary) => {
    const [year, month] = summary.month.split("-").map(Number);
    return sum + daysInMonth(year, month);
  }, 0);
  const totalExpense = used.reduce((sum, summary) => sum + summary.expense, 0);
  const totalVariable = used.reduce((sum, summary) => sum + summary.variable, 0);

  return {
    months: used.map((summary) => summary.month).reverse(),
    averageExpense: Math.round(totalExpense / used.length),
    averageVariable: Math.round(totalVariable / used.length),
    variablePerDay: totalVariable / days,
  };
}
