import type { Metadata } from "next";
import { MonthSwitcher } from "@/components/common/month-switcher";
import { PageHeader } from "@/components/common/page-header";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { currentMonthKey, isValidMonthKey } from "@/lib/dates";
import { getDashboard } from "@/server/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const { monat } = await searchParams;
  const month = isValidMonthKey(monat) ? monat : currentMonthKey();
  const data = await getDashboard(month);
  return (
    <>
      <PageHeader title="Dashboard" description="Dein Monat auf einen Blick" actions={<MonthSwitcher month={month} />} />
      <DashboardView data={data} />
    </>
  );
}
