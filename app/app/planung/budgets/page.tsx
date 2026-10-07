import { requireUser } from "@/lib/session";
import { categories } from "@/lib/mongo";
import { getSettings } from "@/lib/server/user-data";
import { AVERAGE_MONTHS, getCategoryMonths } from "@/lib/server/finance";
import { isMonthKey, monthsUntil, todayIn } from "@/lib/domain/calendar";
import { projectBudget } from "@/lib/domain/budgets";
import { BudgetsView } from "@/features/planung/budgets-view";

export const metadata = { title: "Budgets" };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timeZone);
  const month = isMonthKey(params.monat) ? params.monat : today.slice(0, 7);
  const history = monthsUntil(month, AVERAGE_MONTHS + 1);

  const [categoryDocs, rows] = await Promise.all([
    categories.find({ userId: user.id, kind: "expense" }).sort({ name: 1 }).toArray(),
    getCategoryMonths(user.id, history[0], month),
  ]);

  const lines = categoryDocs
    .map((doc) => {
      const id = doc._id.toString();
      const sumFor = (m: string) => rows.find((row) => row.categoryId === id && row.month === m)?.sumCents ?? 0;
      const previous = history.slice(0, -1).map((m) => ({ month: m, cents: sumFor(m) }));
      const averageCents = Math.round(previous.reduce((s, p) => s + p.cents, 0) / previous.length);
      return {
        categoryId: id,
        name: doc.name,
        color: doc.color,
        history: previous,
        projection: projectBudget({ budgetCents: doc.budgetCents ?? null, spentCents: sumFor(month), averageCents }, month, today),
      };
    })
    .sort((a, b) => b.projection.spentCents - a.projection.spentCents);

  return <BudgetsView month={month} today={today} lines={lines} />;
}
