import { WishesView } from "@/components/views/wishes-view";
import { availability } from "@/lib/domain/overview";
import { compareWishes, resolveWish, wishSummary } from "@/lib/domain/wishes";
import { getFinanceData, loadImports, loadWishes } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Wünsche" };

export default async function WishesPage() {
  const user = await requireUser();
  const [data, wishes, imports] = await Promise.all([getFinanceData(user.id), loadWishes(user.id), loadImports(user.id, "wishes")]);
  const byId = new Map(data.transactions.map((tx) => [tx.id, tx]));
  const resolved = wishes.map((wish) => resolveWish(wish, byId)).sort(compareWishes);
  const avail = availability(data);

  return (
    <WishesView
      wishes={resolved}
      summary={wishSummary(resolved, data.today)}
      forecast={{ monthEnd: avail.monthEnd, projected: avail.projectedMonthEnd, available: avail.available }}
      imports={imports}
    />
  );
}
