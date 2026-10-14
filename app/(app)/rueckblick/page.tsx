import { ReviewView } from "@/components/views/review-view";
import { isMonthKey } from "@/lib/domain/calendar";
import { defaultReviewMonth, monthReview } from "@/lib/domain/review";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Rückblick" };

type Params = Record<string, string | string[] | undefined>;

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const [data, params] = await Promise.all([getFinanceData(user.id), searchParams]);
  const currentMonth = data.today.slice(0, 7);
  const requested = isMonthKey(params.monat) ? params.monat : defaultReviewMonth(data.today);
  const month = requested > currentMonth ? currentMonth : requested;
  return <ReviewView review={monthReview(data.transactions, data.categories, month, data.today)} currentMonth={currentMonth} />;
}
