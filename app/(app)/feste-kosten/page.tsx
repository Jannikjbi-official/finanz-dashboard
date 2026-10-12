import { FixedCostsView } from "@/components/views/fixed-costs-view";
import { addDays } from "@/lib/domain/calendar";
import { fixedCostSummary } from "@/lib/domain/commitments";
import { availability, openItems } from "@/lib/domain/overview";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Feste Kosten" };

export default async function FixedCostsPage() {
  const user = await requireUser();
  const data = await getFinanceData(user.id);
  const summary = fixedCostSummary(data.recurring);
  const avail = availability(data);
  // Tatsaechliche Termine der naechsten 30 Tage aus regelmaessigen Zahlungen
  const upcoming = openItems([], data.recurring, addDays(data.today, 30));
  return (
    <FixedCostsView
      summary={summary}
      recurring={data.recurring}
      upcoming={upcoming}
      available={avail.available}
      monthEnd={avail.monthEnd}
      accounts={data.accounts}
      today={data.today}
    />
  );
}
