import { TransactionsView } from "@/components/views/transactions-view";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Transaktionen" };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ konto?: string }> }) {
  const user = await requireUser();
  const data = await getFinanceData(user.id);
  const { konto } = await searchParams;
  const initialAccount = konto === "ohne" ? "none" : konto && data.accounts.some((a) => a.id === konto) ? konto : null;
  return (
    <TransactionsView
      transactions={data.transactions}
      accounts={data.accounts}
      categories={data.categories}
      today={data.today}
      initialAccount={initialAccount}
    />
  );
}
