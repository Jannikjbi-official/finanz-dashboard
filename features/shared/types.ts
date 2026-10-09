/** Schlanke Auswahllisten fuer Formulare (Client). */
export type CategoryOption = {
  id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
};

export type AccountOption = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
};

export type TransactionRow = {
  id: string;
  type: "income" | "expense";
  amountCents: number;
  title: string;
  note: string | null;
  date: string;
  dateEnd: string | null;
  datePrecision: "day" | "range" | "month";
  categoryId: string | null;
  accountId: string | null;
  recurringId: string | null;
  transferGroupId: string | null;
};

/** Cent als Eingabewert "12,50" fuer Formulare. */
export function centsToInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
