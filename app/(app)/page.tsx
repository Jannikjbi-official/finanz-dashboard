import { DashboardView } from "@/components/views/dashboard-view";
import { buildDashboard } from "@/lib/domain/dashboard";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Übersicht" };

export default async function OverviewPage() {
  const user = await requireUser();
  const data = await getFinanceData(user.id);
  const dashboard = buildDashboard(data);
  return (
    <DashboardView
      dashboard={dashboard}
      recurring={data.recurring}
      pending={data.transactions.filter((tx) => tx.status === "pending")}
    />
  );
}
