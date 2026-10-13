import { addDays, isISODate, type ISODate } from "./calendar";
import type { Account, Category, Cents, TxType } from "./types";

/**
 * Schnellerfassung: eine Buchung in einer Zeile.
 *
 *   -12,50 Lidl gestern @Giro #Lebensmittel
 *   +1035,54 Stadt Oldenburg 07.10.
 *   4,99 Spotify
 *
 * - Betrag: erste Zahl; "+" = Einnahme, "-" oder ohne Vorzeichen = Ausgabe
 * - Datum: heute, gestern, vorgestern, TT.MM. oder TT.MM.JJ(JJ); sonst heute
 * - @Konto und #Kategorie per Namensanfang; ohne @ das erste Girokonto
 * - eine Kategorie wird auch erkannt, wenn ein Wort genau ihr Name ist
 * - der Rest ist die Beschreibung
 */

export type QuickEntry = {
  type: TxType;
  amountCents: Cents | null;
  title: string;
  date: ISODate;
  accountId: string | null;
  categoryId: string | null;
  problems: string[];
};

const AMOUNT = /^([+\-−]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?€?$/;
const DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})?$/;

function byPrefix<T extends { name: string }>(items: T[], query: string) {
  const wanted = query.toLowerCase();
  return items.find((item) => item.name.toLowerCase() === wanted) ?? items.find((item) => item.name.toLowerCase().startsWith(wanted));
}

export function parseQuickEntry(
  text: string,
  context: { today: ISODate; accounts: Account[]; categories: Category[] },
): QuickEntry {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const open = context.accounts.filter((account) => !account.archived);
  const problems: string[] = [];
  const rest: string[] = [];

  let type: TxType = "expense";
  let amountCents: Cents | null = null;
  let date = context.today;
  let accountQuery: string | null = null;
  let categoryQuery: string | null = null;

  for (const word of words) {
    const amount: RegExpMatchArray | null = amountCents === null ? word.match(AMOUNT) : null;
    if (amount) {
      type = amount[1] === "+" ? "income" : "expense";
      amountCents = Number(amount[2].replace(/\./g, "")) * 100 + Number((amount[3] ?? "0").padEnd(2, "0"));
      continue;
    }
    const lower = word.toLowerCase();
    if (lower === "heute") continue;
    if (lower === "gestern" || lower === "vorgestern") {
      date = addDays(context.today, lower === "gestern" ? -1 : -2);
      continue;
    }
    const dated = word.match(DATE);
    if (dated) {
      const year = dated[3] ? (dated[3].length === 2 ? 2000 + Number(dated[3]) : Number(dated[3])) : Number(context.today.slice(0, 4));
      const iso = `${year}-${dated[2].padStart(2, "0")}-${dated[1].padStart(2, "0")}`;
      if (isISODate(iso)) {
        // Ohne Jahr: ein Datum "in der Zukunft" ist meist das letzte Jahr (z. B. 30.12. im Januar)
        date = !dated[3] && iso > addDays(context.today, 31) ? `${year - 1}${iso.slice(4)}` : iso;
        continue;
      }
    }
    if (word.startsWith("@") && word.length > 1) {
      accountQuery = word.slice(1);
      continue;
    }
    if (word.startsWith("#") && word.length > 1) {
      categoryQuery = word.slice(1);
      continue;
    }
    rest.push(word);
  }

  let accountId: string | null = null;
  if (accountQuery) {
    accountId = byPrefix(open, accountQuery)?.id ?? null;
    if (!accountId) problems.push(`Kein Konto „${accountQuery}“`);
  } else {
    accountId = (open.find((account) => account.kind === "giro") ?? open[0])?.id ?? null;
  }

  const kinds = context.categories.filter((category) => category.kind === type);
  let categoryId: string | null = null;
  if (categoryQuery) {
    categoryId = byPrefix(kinds, categoryQuery)?.id ?? null;
    if (!categoryId) problems.push(`Keine Kategorie „${categoryQuery}“`);
  } else {
    categoryId = kinds.find((category) => rest.some((word) => word.toLowerCase() === category.name.toLowerCase()))?.id ?? null;
  }

  const title = rest.join(" ").slice(0, 120);
  if (amountCents === null || amountCents === 0) problems.push("Betrag fehlt");
  if (!title) problems.push("Beschreibung fehlt");
  if (!accountId && !accountQuery) problems.push("Lege zuerst ein Konto an");

  return { type, amountCents, title, date, accountId, categoryId, problems };
}
