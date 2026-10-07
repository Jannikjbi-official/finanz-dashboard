import { requireUser } from "@/lib/session";
import { accounts, goals } from "@/lib/mongo";
import { getSettings } from "@/lib/server/user-data";
import { todayIn } from "@/lib/domain/calendar";
import { goalState } from "@/lib/domain/goals";
import { GoalsPage } from "@/features/planung/goals-view";

export const metadata = { title: "Ziele" };

export default async function ZielePage() {
  const user = await requireUser();
  const [settings, goalDocs, accountDocs] = await Promise.all([
    getSettings(user.id),
    goals.find({ userId: user.id }).sort({ createdAt: 1 }).toArray(),
    accounts.find({ userId: user.id }).sort({ createdAt: 1 }).toArray(),
  ]);
  const today = todayIn(settings.timeZone);

  return (
    <GoalsPage
      goals={goalDocs.map((doc) => {
        const monthlyContributionCents = doc.monthlyContributionCents ?? null;
        return {
          id: doc._id.toString(),
          title: doc.title,
          targetCents: doc.targetCents,
          savedCents: doc.savedCents,
          deadline: doc.deadline ?? null,
          color: doc.color,
          note: doc.note ?? null,
          monthlyContributionCents,
          accountId: doc.accountId ?? null,
          state: goalState({ targetCents: doc.targetCents, savedCents: doc.savedCents, deadline: doc.deadline ?? null, monthlyContributionCents }, today),
        };
      })}
      accounts={accountDocs.map((doc) => ({ id: doc._id.toString(), name: doc.name, color: doc.color, archived: doc.archived }))}
    />
  );
}
