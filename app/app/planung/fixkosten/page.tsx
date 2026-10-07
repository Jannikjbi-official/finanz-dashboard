import { requireUser } from "@/lib/session";
import { categories, recurring } from "@/lib/mongo";
import { getSettings } from "@/lib/server/user-data";
import { todayIn } from "@/lib/domain/calendar";
import { RecurringPage } from "@/features/planung/recurring-view";

export const metadata = { title: "Fixkosten" };

export default async function FixkostenPage() {
  const user = await requireUser();
  const [settings, docs, categoryDocs] = await Promise.all([
    getSettings(user.id),
    recurring.find({ userId: user.id }).toArray(),
    categories.find({ userId: user.id }).sort({ name: 1 }).toArray(),
  ]);

  return (
    <RecurringPage
      today={todayIn(settings.timeZone)}
      entries={docs.map((doc) => ({
        id: doc._id.toString(),
        type: doc.type,
        title: doc.title,
        amountCents: doc.amountCents,
        interval: doc.interval,
        startDate: doc.startDate,
        nextDue: doc.nextDue,
        active: doc.active,
        categoryId: doc.categoryId ?? null,
        note: doc.note ?? null,
      }))}
      categories={categoryDocs.map((doc) => ({ id: doc._id.toString(), name: doc.name, kind: doc.kind, color: doc.color }))}
    />
  );
}
