import { daysBetween, monthEnd, monthOf, type ISODate } from "./calendar";
import { accountBalances, isTransfer, liquidAccountIds, type MonthSummary, type SpendingBaseline } from "./ledger";
import { openDues } from "./recurring";
import type { Account, Cents, CostType, Recurring, Transaction, TxType } from "./types";

/**
 * Ein offener, noch nicht geflossener Betrag: der Termin einer
 * regelmaessigen Zahlung oder eine geplante/erwartete Einzelbuchung.
 */
export type OpenItem = {
  key: string;
  source: "recurring" | "transaction";
  sourceId: string;
  type: TxType;
  title: string;
  provider: string | null;
  amountCents: Cents;
  date: ISODate;
  costType: CostType | null;
  accountId: string | null;
  categoryId: string | null;
  /** Von der Bank vorgemerkt - schon unterwegs, nur noch nicht gebucht. */
  bankPending: boolean;
};

/**
 * Alle offenen Posten bis einschliesslich `until` - inklusive ueberfaelliger.
 * Gleicher Tag: Ausgaben vor Einnahmen (vorsichtige Reihenfolge).
 */
export function openItems(transactions: Transaction[], recurring: Recurring[], until: ISODate): OpenItem[] {
  const items: OpenItem[] = [];

  for (const tx of transactions) {
    if (tx.status !== "pending" || isTransfer(tx) || tx.date > until) continue;
    items.push({
      key: `tx:${tx.id}`,
      source: "transaction",
      sourceId: tx.id,
      type: tx.type,
      title: tx.title,
      provider: null,
      amountCents: tx.amountCents,
      date: tx.date,
      costType: null,
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      bankPending: Boolean(tx.bankPending),
    });
  }

  for (const entry of recurring) {
    for (const date of openDues(entry, until)) {
      items.push({
        key: `rec:${entry.id}:${date}`,
        source: "recurring",
        sourceId: entry.id,
        type: entry.type,
        title: entry.title,
        provider: entry.provider,
        amountCents: entry.amountCents,
        date,
        costType: entry.costType,
        accountId: entry.accountId,
        categoryId: entry.categoryId,
        bankPending: false,
      });
    }
  }

  return items.sort(compareItems);
}

function compareItems(a: OpenItem, b: OpenItem) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.type !== b.type) return a.type === "expense" ? -1 : 1;
  return b.amountCents - a.amountCents;
}

export type ForecastPoint = { date: ISODate; item: OpenItem; balanceAfter: Cents };

export type Availability = {
  today: ISODate;
  monthEnd: ISODate;
  /** Summe aller nicht archivierten Konten (inkl. Sparkonten). */
  totalBalance: Cents;
  /** Tatsaechliches Guthaben auf liquiden Konten. */
  liquidBalance: Cents;
  /** Von der Bank vorgemerkte Ausgaben: schon unterwegs, noch nicht gebucht. */
  bankPending: { total: Cents; items: OpenItem[] };
  /** Faellig (heute oder frueher), aber noch nicht bezahlt. */
  dueUnpaid: { total: Cents; items: OpenItem[] };
  /** Bekannte Ausgaben nach heute bis Monatsende. */
  plannedExpenses: { total: Cents; items: OpenItem[] };
  /** Noch nicht eingegangene Einnahmen bis Monatsende (auch ueberfaellige). */
  expectedIncome: { total: Cents; items: OpenItem[] };
  /** liquidBalance - bankPending - dueUnpaid - plannedExpenses. Erwartete Einnahmen zaehlen NICHT. */
  available: Cents;
  /** available + expectedIncome: Prognose fuer den Monatsletzten. */
  projectedMonthEnd: Cents;
  /** Verlauf bis Monatsende, Ueberfaelliges wird auf heute gelegt. */
  forecast: ForecastPoint[];
  lowestPoint: { date: ISODate; balance: Cents };
};

/**
 * Kernkennzahl "Aktuell verfuegbar".
 *
 * Betrachtet werden nur liquide Konten. Offene Posten zaehlen mit, wenn sie
 * keinem Konto oder einem liquiden Konto zugeordnet sind. Bezahlte Termine
 * sind bereits Buchungen und liegen vor `nextDue` - sie werden daher nie ein
 * zweites Mal abgezogen.
 */
export function availability(input: {
  accounts: Account[];
  transactions: Transaction[];
  recurring: Recurring[];
  today: ISODate;
}): Availability {
  const { accounts, transactions, recurring, today } = input;
  const end = monthEnd(monthOf(today));
  const liquid = liquidAccountIds(accounts);
  const known = new Set(accounts.map((account) => account.id));
  // Gebuchtes mit Datum nach heute zaehlt noch nicht
  const balances = accountBalances(accounts, transactions, today);

  let totalBalance = 0;
  let liquidBalance = 0;
  for (const account of accounts) {
    if (account.archived) continue;
    const balance = balances.get(account.id) ?? 0;
    totalBalance += balance;
    if (liquid.has(account.id)) liquidBalance += balance;
  }

  // Ohne Konto: zaehlt mit. Mit Konto: nur liquide. Unbekannte Konten: wie ohne.
  const counts = (item: OpenItem) => !item.accountId || !known.has(item.accountId) || liquid.has(item.accountId);
  const items = openItems(transactions, recurring, end).filter(counts);

  const bankPending = items.filter((item) => item.type === "expense" && item.bankPending);
  const dueUnpaid = items.filter((item) => item.type === "expense" && !item.bankPending && item.date <= today);
  const plannedExpenses = items.filter((item) => item.type === "expense" && !item.bankPending && item.date > today);
  const expectedIncome = items.filter((item) => item.type === "income");

  const sum = (list: OpenItem[]) => list.reduce((total, item) => total + item.amountCents, 0);
  const available = liquidBalance - sum(bankPending) - sum(dueUnpaid) - sum(plannedExpenses);

  let running = liquidBalance;
  let lowestPoint = { date: today, balance: liquidBalance };
  const forecast = items.map((item) => {
    const date = item.date < today ? today : item.date;
    running += item.type === "income" ? item.amountCents : -item.amountCents;
    if (running < lowestPoint.balance) lowestPoint = { date, balance: running };
    return { date, item, balanceAfter: running };
  });

  return {
    today,
    monthEnd: end,
    totalBalance,
    liquidBalance,
    bankPending: { total: sum(bankPending), items: bankPending },
    dueUnpaid: { total: sum(dueUnpaid), items: dueUnpaid },
    plannedExpenses: { total: sum(plannedExpenses), items: plannedExpenses },
    expectedIncome: { total: sum(expectedIncome), items: expectedIncome },
    available,
    projectedMonthEnd: available + sum(expectedIncome),
    forecast,
    lowestPoint,
  };
}

export type SavingsEstimate = {
  /** Gebuchte plus noch erwartete Einnahmen dieses Monats. */
  income: Cents;
  /** Gebuchte Ausgaben plus alle offenen Verpflichtungen bis Monatsende. */
  committed: Cents;
  /** Geschaetzte variable Ausgaben fuer die restlichen Tage, null ohne Historie. */
  variableReserve: Cents | null;
  remainingDays: number;
  /** Was nach allem voraussichtlich uebrig bleibt (kann negativ sein). */
  amount: Cents;
};

/**
 * "Wie viel kann ich realistisch sparen?" fuer den laufenden Monat.
 * Restliche variable Ausgaben werden aus dem eigenen Durchschnitt pro Tag
 * geschaetzt - gibt es keine Historie, wird nichts geschaetzt und das so
 * ausgewiesen.
 */
export function savingsEstimate(input: {
  current: MonthSummary;
  availability: Availability;
  baseline: SpendingBaseline | null;
}): SavingsEstimate | null {
  const { current, availability: a, baseline } = input;
  const income = current.income + a.expectedIncome.total;
  if (income === 0) return null;

  const committed = current.expense + a.bankPending.total + a.dueUnpaid.total + a.plannedExpenses.total;
  const remainingDays = daysBetween(a.today, a.monthEnd);
  const variableReserve = baseline ? Math.round(baseline.variablePerDay * remainingDays) : null;

  return {
    income,
    committed,
    variableReserve,
    remainingDays,
    amount: income - committed - (variableReserve ?? 0),
  };
}

