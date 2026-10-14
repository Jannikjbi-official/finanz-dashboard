import { CategoriesView } from "@/components/views/categories-view";
import { categoryBreakdown } from "@/lib/domain/categories";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Kategorien" };

type Params = Record<string, string | string[] | undefined>;

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const data = await getFinanceData(user.id);
  const params = await searchParams;
  const currentMonth = data.today.slice(0, 7);
  const requested = typeof params.monat === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.monat) ? params.monat : currentMonth;
  // Keine Zukunftsmonate: dort ist nichts gebucht
  const month = requested > currentMonth ? currentMonth : requested;
  const kind = params.art === "einnahmen" ? "income" : "expense";
  return <CategoriesView breakdown={categoryBreakdown(data.transactions, data.categories, month, kind)} currentMonth={currentMonth} />;
}
