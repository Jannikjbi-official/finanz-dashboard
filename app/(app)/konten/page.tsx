import { AccountsView } from "@/components/views/accounts-view";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Konten" };

export default async function AccountsPage() {
  const user = await requireUser();
  const data = await getFinanceData(user.id);
  return <AccountsView accounts={data.accounts} transactions={data.transactions.filter((tx) => tx.status === "booked")} categories={data.categories} />;
}
