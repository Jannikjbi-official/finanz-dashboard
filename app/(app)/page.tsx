import { DashboardView } from "@/components/views/dashboard-view";
import { categoryBreakdown } from "@/lib/domain/categories";
import { buildDashboard } from "@/lib/domain/dashboard";
import { getFinanceData, loadImports } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Übersicht" };

export default async function OverviewPage() {
  const user = await requireUser();
  const [data, imports] = await Promise.all([getFinanceData(user.id), loadImports(user.id, "transactions")]);
  const dashboard = buildDashboard(data);
  // Frischer Import (letzte 7 Tage): Rueckgaengig direkt auf der Uebersicht anbieten
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const lastImport = imports.find((entry) => !entry.undoneAt && entry.createdAt >= weekAgo) ?? null;
  return (
    <DashboardView
      dashboard={dashboard}
      recurring={data.recurring}
      pending={data.transactions.filter((tx) => tx.status === "pending")}
      lastImport={lastImport}
      categories={data.categories.length > 0 ? categoryBreakdown(data.transactions, data.categories, dashboard.month) : null}
    />
  );
}
