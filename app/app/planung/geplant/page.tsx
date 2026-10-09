import { requireUser } from "@/lib/session";
import { accounts, categories, planned, type PlannedDoc } from "@/lib/mongo";
import { getSettings } from "@/lib/server/user-data";
import { todayIn } from "@/lib/domain/calendar";
import { PlannedPage, type PlannedView } from "@/features/planung/planned-view";
import type { WithId } from "mongodb";

export const metadata = { title: "Geplant & erwartet" };

function toView(doc: WithId<PlannedDoc>): PlannedView {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    title: doc.title,
    amountCents: doc.amountCents,
    dateFrom: doc.dateFrom,
    dateTo: doc.dateTo,
    certainty: doc.certainty,
    status: doc.status,
    categoryId: doc.categoryId,
    accountId: doc.accountId,
    note: doc.note,
  };
}

export default async function GeplantPage() {
  const user = await requireUser();
  const [settings, openDocs, doneDocs, categoryDocs, accountDocs] = await Promise.all([
    getSettings(user.id),
    planned.find({ userId: user.id, status: "open" }).toArray(),
    planned.find({ userId: user.id, status: "done" }).sort({ createdAt: -1 }).limit(10).toArray(),
    categories.find({ userId: user.id }).sort({ name: 1 }).toArray(),
    accounts.find({ userId: user.id }).sort({ createdAt: 1 }).toArray(),
  ]);

  // Mit Termin zuerst, nach Datum; offene Termine ans Ende
  const open = openDocs
    .map(toView)
    .sort((a, b) => (a.dateFrom ?? a.dateTo ?? "9999").localeCompare(b.dateFrom ?? b.dateTo ?? "9999"));

  return (
    <PlannedPage
      open={open}
      done={doneDocs.map(toView)}
      today={todayIn(settings.timeZone)}
      categories={categoryDocs.map((doc) => ({ id: doc._id.toString(), name: doc.name, kind: doc.kind, color: doc.color }))}
      accounts={accountDocs.map((doc) => ({ id: doc._id.toString(), name: doc.name, color: doc.color, archived: doc.archived }))}
    />
  );
}
