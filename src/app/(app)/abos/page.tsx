import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { SubscriptionsView } from "@/components/subscriptions/subscriptions-view";
import { getSubscriptionPage } from "@/server/queries";

export const metadata: Metadata = { title: "Abos" };

export default async function SubscriptionsPage() {
  const data = await getSubscriptionPage();
  return (
    <>
      <PageHeader title="Abos" description="Alle Abos mit Monats- und Jahreskosten" />
      <SubscriptionsView data={data} />
    </>
  );
}
