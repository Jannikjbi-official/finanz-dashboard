import { TransactionsView } from "@/components/views/transactions-view";
import { parseFilter } from "@/lib/domain/transaction-filter";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";
import { countTrash } from "@/lib/server/trash";

export const metadata = { title: "Transaktionen" };

type Params = Record<string, string | string[] | undefined>;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const [data, trashCount] = await Promise.all([getFinanceData(user.id), countTrash(user.id)]);
  const raw = await searchParams;
  const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const filter = parseFilter(params, data.today.slice(0, 7));
  // Nur eigene Konten und Kategorien als Filter zulassen
  if (filter.account !== "all" && filter.account !== "none" && !data.accounts.some((a) => a.id === filter.account)) filter.account = "all";
  if (filter.category !== "all" && filter.category !== "none" && !data.categories.some((c) => c.id === filter.category)) filter.category = "all";
  return (
    <TransactionsView
      transactions={data.transactions}
      accounts={data.accounts}
      categories={data.categories}
      today={data.today}
      initialFilter={filter}
      trashCount={trashCount}
    />
  );
}
