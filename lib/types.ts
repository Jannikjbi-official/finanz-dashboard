import type { Interval, Kind } from "./mongo";

export type Category = {
  id: string;
  name: string;
  kind: Kind;
  color: string;
  icon: string;
  budgetCents: number | null;
};

export type Transaction = {
  id: string;
  type: Kind;
  amountCents: number;
  title: string;
  note: string | null;
  date: string;
  categoryId: string | null;
  recurringId: string | null;
  accountId: string | null;
};

export type Recurring = {
  id: string;
  type: Kind;
  amountCents: number;
  title: string;
  interval: Interval;
  categoryId: string | null;
  startDate: string;
  nextDue: string;
  active: boolean;
  note: string | null;
};

export type { Interval, Kind };

export type AccountKind = "giro" | "cash" | "savings" | "other";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  startBalanceCents: number;
  balanceCents: number;
  color: string;
  icon: string;
  archived: boolean;
  transactionCount: number;
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  giro: "Girokonto",
  cash: "Bargeld",
  savings: "Sparkonto",
  other: "Sonstiges",
};

export type Goal = {
  id: string;
  title: string;
  targetCents: number;
  savedCents: number;
  deadline: string | null;
  color: string;
  note: string | null;
};
