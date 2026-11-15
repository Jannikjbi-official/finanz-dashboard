import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ExpensesView } from "@/components/expenses/expenses-view";
import { monthRange, currentMonthKey } from "@/lib/dates";
import { listExpenses } from "@/server/queries";

export const metadata: Metadata = { title: "Ausgaben" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ von?: string; bis?: string }>;
}) {
  const { von, bis } = await searchParams;
  const range = monthRange(currentMonthKey());
  const from = von && ISO.test(von) ? von : range.start.toString();
  const to = bis && ISO.test(bis) ? bis : range.end.toString();
  const rows = await listExpenses(from, to);
  return (
    <>
      <PageHeader title="Ausgaben" description="Alle Ausgaben durchsuchen, filtern und bearbeiten" />
      <ExpensesView initialRows={rows} initialFrom={from} initialTo={to} />
    </>
  );
}
