import { notFound } from "next/navigation";
import { CategoryDetailView } from "@/components/views/category-detail-view";
import { categoryDetail, NO_CATEGORY } from "@/lib/domain/categories";
import { getFinanceData, loadRules } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getFinanceData(user.id);
  return { title: id === NO_CATEGORY ? "Ohne Kategorie" : (data.categories.find((category) => category.id === id)?.name ?? "Kategorie") };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [data, rules] = await Promise.all([getFinanceData(user.id), loadRules(user.id)]);

  // Nur eigene Kategorien; "none" fasst Buchungen ohne Kategorie zusammen
  const category = data.categories.find((entry) => entry.id === id) ?? null;
  if (!category && id !== NO_CATEGORY) notFound();
  const kind = category?.kind ?? (query.art === "einnahmen" ? "income" : "expense");

  return (
    <CategoryDetailView
      name={category?.name ?? "Ohne Kategorie"}
      color={category?.color ?? null}
      detail={categoryDetail(data.transactions, id, kind, data.today)}
      rules={category ? rules.filter((rule) => rule.categoryId === id) : []}
      recurring={data.recurring.filter((entry) => (category ? entry.categoryId === id : !entry.categoryId) && entry.type === kind && entry.status !== "archived")}
    />
  );
}
