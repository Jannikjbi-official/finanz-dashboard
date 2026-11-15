import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { WishlistView } from "@/components/wishlist/wishlist-view";
import { getWishPage } from "@/server/queries";

export const metadata: Metadata = { title: "Wunschliste" };

export default async function WishlistPage() {
  const data = await getWishPage();
  return (
    <>
      <PageHeader title="Wunschliste" description="Sparziele für die Dinge, die du dir wünschst" />
      <WishlistView {...data} />
    </>
  );
}
