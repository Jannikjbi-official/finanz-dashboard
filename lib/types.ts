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
