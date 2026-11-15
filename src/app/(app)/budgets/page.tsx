import type { Metadata } from "next";
import { BudgetsView } from "@/components/budgets/budgets-view";
import { MonthSwitcher } from "@/components/common/month-switcher";
import { PageHeader } from "@/components/common/page-header";
import { currentMonthKey, isValidMonthKey } from "@/lib/dates";
import { getBudgetPage } from "@/server/queries";

export const metadata: Metadata = { title: "Budgets & Kategorien" };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const { monat } = await searchParams;
  const month = isValidMonthKey(monat) ? monat : currentMonthKey();
  const data = await getBudgetPage(month);
  return (
    <>
      <PageHeader
        title="Budgets & Kategorien"
        description="Monatsbudgets inkl. Abos – Warnung ab 80 %"
        actions={<MonthSwitcher month={month} />}
      />
      <BudgetsView month={month} categories={data.categories} />
    </>
  );
}
