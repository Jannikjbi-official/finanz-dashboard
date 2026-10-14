import { addDays, monthEnd, monthOf, shiftMonth, type ISODate } from "./calendar";
import { accountBalances, dataStart, liquidAccountIds, signedAmount } from "./ledger";
import type { ForecastPoint } from "./overview";
import type { Account, Cents, Transaction } from "./types";

/**
 * Kontostand ueber die Zeit: gebuchte Vergangenheit und Prognose bis
 * Monatsende (aus availability().forecast), sowie das Vermoegen je Monat.
 */

export type TimelinePoint = {
  date: ISODate;
  balance: Cents;
  /** Prognose statt gebuchtem Stand. */
  forecast: boolean;
  /** Bewegungen an diesem Tag (Prognose: erwartete Posten). */
  changes: Array<{ title: string; amount: Cents }>;
};

/**
 * Verfuegbare Konten Tag fuer Tag: die letzten `days` Tage (nicht vor
 * Datenbeginn) bis heute, danach die Prognose bis Monatsende. Der heutige
 * Punkt zeigt den gebuchten Stand; Ueberfaelliges der Prognose liegt auf
 * dem ersten Prognosepunkt "heute".
 */
export function liquidTimeline(input: {
  accounts: Account[];
  transactions: Transaction[];
  today: ISODate;
  forecast: ForecastPoint[];
  days?: number;
}): TimelinePoint[] {
  const { accounts, transactions, today, forecast, days = 30 } = input;
  const liquid = liquidAccountIds(accounts);
  const start = dataStart(transactions);
  let from = addDays(today, -days);
  // Vor dem Datenbeginn gibt es keinen Verlauf - ein Tag davor zeigt den Ausgangsstand
  if (start && addDays(start, -1) > from) from = addDays(start, -1);
  if (from > today) from = today;

  const balances = accountBalances(accounts, transactions, today);
  let balance = [...liquid].reduce((sum, id) => sum + (balances.get(id) ?? 0), 0);

  // Gebuchte Bewegungen liquider Konten je Tag
  const byDay = new Map<ISODate, Array<{ title: string; amount: Cents }>>();
  for (const tx of transactions) {
    if (tx.status !== "booked" || !tx.accountId || !liquid.has(tx.accountId) || tx.date <= from || tx.date > today) continue;
    byDay.set(tx.date, [...(byDay.get(tx.date) ?? []), { title: tx.title, amount: signedAmount(tx) }]);
  }

  // Rueckwaerts vom heutigen Stand
  const past: TimelinePoint[] = [];
  for (let day = today; day >= from; day = addDays(day, -1)) {
    const changes = byDay.get(day) ?? [];
    past.push({ date: day, balance, forecast: false, changes });
    balance -= changes.reduce((sum, change) => sum + change.amount, 0);
  }
  past.reverse();

  // Prognose: ein Punkt je Tag mit Posten, plus Monatsende
  const future: TimelinePoint[] = [];
  const todayBalance = past[past.length - 1]?.balance ?? 0;
  let running = todayBalance;
  for (const point of forecast) {
    const last = future[future.length - 1];
    const change = { title: point.item.title, amount: point.item.type === "income" ? point.item.amountCents : -point.item.amountCents };
    running = point.balanceAfter;
    if (last && last.date === point.date) {
      last.balance = running;
      last.changes.push(change);
    } else {
      future.push({ date: point.date, balance: running, forecast: true, changes: [change] });
    }
  }
  const end = monthEnd(monthOf(today));
  if (future.length > 0 || end > today) {
    const last = future[future.length - 1];
    if (!last || last.date < end) future.push({ date: end, balance: running, forecast: true, changes: [] });
  }
  return [...past, ...future];
}

export type WorthPoint = { date: ISODate; total: Cents; liquid: Cents; current: boolean };

/**
 * Vermoegen (alle nicht archivierten Konten) jeweils am Monatsende, fuer
 * die letzten `months` Monate ab Datenbeginn, plus der heutige Stand.
 */
export function netWorthHistory(accounts: Account[], transactions: Transaction[], today: ISODate, months = 12): WorthPoint[] {
  const start = dataStart(transactions);
  if (!start) return [];
  const active = accounts.filter((account) => !account.archived);
  const liquid = liquidAccountIds(accounts);
  const current = monthOf(today);
  const points: WorthPoint[] = [];

  const at = (date: ISODate, isCurrent: boolean) => {
    const balances = accountBalances(active, transactions, date);
    let total = 0;
    let liquidTotal = 0;
    for (const account of active) {
      const value = balances.get(account.id) ?? 0;
      total += value;
      if (liquid.has(account.id)) liquidTotal += value;
    }
    points.push({ date, total, liquid: liquidTotal, current: isCurrent });
  };

  // Stand vor dem ersten erfassten Tag als Ausgangspunkt
  at(addDays(start, -1), false);
  for (let offset = months - 1; offset >= 1; offset -= 1) {
    const end = monthEnd(shiftMonth(current, -offset));
    if (end < start) continue;
    at(end, false);
  }
  at(today, true);
  return points;
}
