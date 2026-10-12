import { SubscriptionsView } from "@/components/views/subscriptions-view";
import { chargesByMonth, isSubscription, subscriptionSummary } from "@/lib/domain/commitments";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Abonnements" };

export default async function SubscriptionsPage() {
  const user = await requireUser();
  const data = await getFinanceData(user.id);
  const subscriptions = data.recurring.filter(isSubscription);
  const summary = subscriptionSummary(data.recurring, data.today);
  const charges = chargesByMonth(subscriptions, data.today, 12).map((bucket) => ({
    month: bucket.month,
    total: bucket.total,
    charges: bucket.charges.map((charge) => ({ title: charge.entry.title, date: charge.date, amountCents: charge.entry.amountCents })),
  }));
  return <SubscriptionsView summary={summary} charges={charges} accounts={data.accounts} today={data.today} />;
}
