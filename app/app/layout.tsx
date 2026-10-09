import { requireUser } from "@/lib/session";
import { accounts, categories } from "@/lib/mongo";
import { getSettings } from "@/lib/server/user-data";
import { todayIn } from "@/lib/domain/calendar";
import { AppShell } from "@/features/shell/app-shell";

export const metadata = { robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [settings, categoryDocs, accountDocs] = await Promise.all([
    getSettings(user.id),
    categories.find({ userId: user.id }).sort({ kind: 1, name: 1 }).toArray(),
    accounts.find({ userId: user.id }).sort({ createdAt: 1 }).toArray(),
  ]);

  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      today={todayIn(settings.timeZone)}
      categories={categoryDocs.map((doc) => ({
        id: doc._id.toString(),
        name: doc.name,
        kind: doc.kind,
        color: doc.color,
      }))}
      accounts={accountDocs.map((doc) => ({
        id: doc._id.toString(),
        name: doc.name,
        color: doc.color,
        archived: doc.archived,
      }))}
    >
      {children}
    </AppShell>
  );
}
