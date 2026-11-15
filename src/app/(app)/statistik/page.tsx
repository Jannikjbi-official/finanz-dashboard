import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { StatsView } from "@/components/stats/stats-view";
import { fromIso, today } from "@/lib/dates";
import { getStats } from "@/server/queries";

export const metadata: Metadata = { title: "Statistik" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ von?: string; bis?: string }> }) {
  const { von, bis } = await searchParams;
  const t = today();
  let from = von && ISO.test(von) ? von : t.subtract({ days: 29 }).toString();
  let to = bis && ISO.test(bis) ? bis : t.toString();
  if (fromIso(from).compare(fromIso(to)) > 0) [from, to] = [to, from];
  // Höchstens 3 Jahre auf einmal
  if (fromIso(to).compare(fromIso(from)) > 1100) from = fromIso(to).subtract({ days: 1100 }).toString();
  const data = await getStats(from, to);
  return (
    <>
      <PageHeader title="Statistik" description="Auswertungen für einen beliebigen Zeitraum" />
      <StatsView data={data} />
    </>
  );
}
