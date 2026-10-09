import { requireUser } from "@/lib/session";
import { categories, transactions } from "@/lib/mongo";
import { PageHeader } from "@/ui/layout";
import { CategoriesManager } from "@/features/settings/categories-manager";

export const metadata = { title: "Kategorien" };

export default async function KategorienPage() {
  const user = await requireUser();
  const [docs, usage] = await Promise.all([
    categories.find({ userId: user.id }).sort({ name: 1 }).toArray(),
    transactions
      .aggregate<{ _id: string; count: number }>([
        { $match: { userId: user.id, categoryId: { $nin: [null] } } },
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const usageById = new Map(usage.map((row) => [row._id, row.count]));

  return (
    <div className="max-w-3xl">
      <PageHeader title="Kategorien" description="Ordnen Buchungen, Budgets und Auswertungen. Budgets setzt du auch direkt unter Planung → Budgets." />
      <CategoriesManager
        categories={docs.map((doc) => ({
          id: doc._id.toString(),
          name: doc.name,
          kind: doc.kind,
          color: doc.color,
          budgetCents: doc.budgetCents ?? null,
          usage: usageById.get(doc._id.toString()) ?? 0,
        }))}
      />
    </div>
  );
}
