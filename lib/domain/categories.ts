import { monthEnd, monthOf, monthStart, shiftMonth, type ISODate, type MonthKey } from "./calendar";
import { dataStart, isTransfer, partialFrom, spendingBaseline } from "./ledger";
import type { Category, Cents, Transaction, TxType } from "./types";

/**
 * Auswertung nach Kategorien. Wie ueberall zaehlen nur gebuchte Betraege,
 * keine Transfers; Durchschnitte nur aus vollstaendig erfassten Monaten
 * (dieselben Monate wie "Ø Ausgaben" auf der Uebersicht).
 */

/** "none" steht fuer Buchungen ohne Kategorie. */
export const NO_CATEGORY = "none";

export type CategoryStat = {
  id: string;
  name: string;
  color: string | null;
  /** Gebucht im gewaehlten Monat. */
  amount: Cents;
  count: number;
  /** Ø je vollstaendigem Monat; null ohne solchen Monat. */
  average: Cents | null;
  /** Anteil an allen Betraegen dieser Art im Monat (0..1). */
  share: number;
};

/** Liegt der Betrag deutlich ueber dem Durchschnitt? (mind. 10 % und 5 €) */
export function aboveAverage(stat: Pick<CategoryStat, "amount" | "average">) {
  return stat.average !== null && stat.average > 0 && stat.amount - stat.average >= Math.max(5_00, stat.average * 0.1);
}

export type CategoryBreakdown = {
  month: MonthKey;
  kind: TxType;
  total: Cents;
  items: CategoryStat[];
  /** Monate, aus denen die Durchschnitte stammen. */
  averageMonths: MonthKey[];
  /** Gewaehlter Monat nur teilweise erfasst bzw. noch nicht vorbei. */
  partialFrom: ISODate | null;
};

function booked(tx: Transaction, kind: TxType) {
  return tx.status === "booked" && tx.type === kind && !isTransfer(tx);
}

/** Monate fuer den Durchschnitt: bis zu drei vollstaendige Monate vor `month`. */
function averageMonths(transactions: Transaction[], month: MonthKey) {
  return spendingBaseline(transactions, monthStart(month), 3, dataStart(transactions))?.months ?? [];
}

export function categoryBreakdown(transactions: Transaction[], categories: Category[], month: MonthKey, kind: TxType = "expense"): CategoryBreakdown {
  const from = monthStart(month);
  const to = monthEnd(month);
  const months = averageMonths(transactions, month);
  const inAverage = new Set(months);

  const totals = new Map<string, { amount: Cents; count: number; past: Cents }>();
  for (const tx of transactions) {
    if (!booked(tx, kind)) continue;
    const key = tx.categoryId ?? NO_CATEGORY;
    const entry = totals.get(key) ?? { amount: 0, count: 0, past: 0 };
    if (tx.date >= from && tx.date <= to) {
      entry.amount += tx.amountCents;
      entry.count += 1;
    } else if (inAverage.has(monthOf(tx.date))) {
      entry.past += tx.amountCents;
    } else {
      continue;
    }
    totals.set(key, entry);
  }

  const byId = new Map(categories.map((category) => [category.id, category]));
  const total = [...totals.values()].reduce((sum, entry) => sum + entry.amount, 0);
  const items: CategoryStat[] = [...totals.entries()].map(([id, entry]) => {
    const category = byId.get(id);
    return {
      id: category ? id : NO_CATEGORY,
      name: category?.name ?? "Ohne Kategorie",
      color: category?.color ?? null,
      amount: entry.amount,
      count: entry.count,
      average: months.length > 0 ? Math.round(entry.past / months.length) : null,
      share: total > 0 ? entry.amount / total : 0,
    };
  });
  // Geloeschte Kategorien landen unter "Ohne Kategorie"
  const merged = new Map<string, CategoryStat>();
  for (const item of items) {
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      continue;
    }
    existing.amount += item.amount;
    existing.count += item.count;
    existing.share += item.share;
    if (existing.average !== null && item.average !== null) existing.average += item.average;
  }

  return {
    month,
    kind,
    total,
    items: [...merged.values()].sort((a, b) => b.amount - a.amount || (b.average ?? 0) - (a.average ?? 0) || a.name.localeCompare(b.name, "de")),
    averageMonths: months,
    partialFrom: partialFrom(month, dataStart(transactions)),
  };
}

export type CategoryMonth = { month: MonthKey; amount: Cents; count: number; partialFrom: ISODate | null; current: boolean };

export type Payee = { name: string; amount: Cents; count: number; last: ISODate };

export type CategoryDetail = {
  id: string;
  kind: TxType;
  history: CategoryMonth[];
  average: Cents | null;
  averageMonths: MonthKey[];
  /** Summe der letzten 12 Monate (soweit erfasst). */
  yearTotal: Cents;
  payees: Payee[];
  /** Neueste Buchungen zuerst (auch geplante). */
  recent: Transaction[];
};

/** Haendler-Schluessel: "Lidl Sagt Danke 123" und "LIDL Wilhelmshaven" -> "lidl". */
export function payeeKey(title: string) {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return title.toLowerCase();
  return words[0].length >= 4 ? words[0] : words.slice(0, 2).join(" ");
}

/** Verlauf, Durchschnitt und haeufigste Empfaenger einer Kategorie (id "none": ohne Kategorie). */
export function categoryDetail(transactions: Transaction[], id: string, kind: TxType, today: ISODate): CategoryDetail {
  const matches = (tx: Transaction) => (id === NO_CATEGORY ? !tx.categoryId : tx.categoryId === id) && !isTransfer(tx) && tx.type === kind;
  const current = monthOf(today);
  const start = dataStart(transactions);
  const first = start ? monthOf(start) : current;

  const history: CategoryMonth[] = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const month = shiftMonth(current, -offset);
    if (month < first) continue;
    history.push({ month, amount: 0, count: 0, partialFrom: partialFrom(month, start), current: month === current });
  }
  const byMonth = new Map(history.map((entry) => [entry.month, entry]));

  const months = averageMonths(transactions, current);
  const inAverage = new Set(months);
  let pastTotal = 0;
  const groups = new Map<string, { names: Map<string, number>; amount: Cents; count: number; last: ISODate }>();
  const yearStart = history[0]?.month ?? current;

  for (const tx of transactions) {
    if (!matches(tx) || tx.status !== "booked") continue;
    const month = monthOf(tx.date);
    const entry = byMonth.get(month);
    if (entry) {
      entry.amount += tx.amountCents;
      entry.count += 1;
    }
    if (inAverage.has(month)) pastTotal += tx.amountCents;
    if (month < yearStart || month > current) continue;
    const key = payeeKey(tx.title);
    const group = groups.get(key) ?? { names: new Map(), amount: 0, count: 0, last: tx.date };
    group.names.set(tx.title, (group.names.get(tx.title) ?? 0) + 1);
    group.amount += tx.amountCents;
    group.count += 1;
    if (tx.date > group.last) group.last = tx.date;
    groups.set(key, group);
  }

  const payees = [...groups.values()]
    .map((group) => ({
      // Anzeigename: der haeufigste Originaltitel
      name: [...group.names.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0],
      amount: group.amount,
      count: group.count,
      last: group.last,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const recent = transactions
    .filter(matches)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 15);

  return {
    id,
    kind,
    history,
    average: months.length > 0 ? Math.round(pastTotal / months.length) : null,
    averageMonths: months,
    yearTotal: history.reduce((sum, entry) => sum + entry.amount, 0),
    payees,
    recent,
  };
}
