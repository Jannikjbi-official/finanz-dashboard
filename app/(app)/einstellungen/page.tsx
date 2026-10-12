import { SettingsView } from "@/components/views/settings-view";
import { getFinanceData } from "@/lib/server/data";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireUser();
  const data = await getFinanceData(user.id);
  const usage = new Map<string, number>();
  for (const tx of data.transactions) if (tx.categoryId) usage.set(tx.categoryId, (usage.get(tx.categoryId) ?? 0) + 1);
  return (
    <SettingsView
      user={{ name: user.name, email: user.email }}
      timeZone={data.timeZone}
      categories={data.categories.map((c) => ({ ...c, usage: usage.get(c.id) ?? 0 }))}
      accounts={data.accounts}
      counts={{ transactions: data.transactions.length, recurring: data.recurring.length, accounts: data.accounts.length }}
    />
  );
}
