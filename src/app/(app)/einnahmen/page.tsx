import type { Metadata } from "next";
import { MonthSwitcher } from "@/components/common/month-switcher";
import { PageHeader } from "@/components/common/page-header";
import { IncomeView } from "@/components/income/income-view";
import { currentMonthKey, isValidMonthKey } from "@/lib/dates";
import { getIncomePage } from "@/server/queries";

export const metadata: Metadata = { title: "Einnahmen" };

export default async function IncomePage({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const { monat } = await searchParams;
  const month = isValidMonthKey(monat) ? monat : currentMonthKey();
  const data = await getIncomePage(month);
  return (
    <>
      <PageHeader title="Einnahmen" description="Gehalt, Twitch, Nebenjob & mehr" actions={<MonthSwitcher month={month} />} />
      <IncomeView data={data} />
    </>
  );
}
