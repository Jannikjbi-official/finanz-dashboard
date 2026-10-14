import { SettingsView } from "@/components/views/settings-view";
import { getFinanceData, loadImports, loadRules } from "@/lib/server/data";
import { getSecurityOverview } from "@/lib/server/security";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [data, security, imports, rules] = await Promise.all([
    getFinanceData(user.id),
    getSecurityOverview(),
    loadImports(user.id, "transactions"),
    loadRules(user.id),
  ]);
  const usage = new Map<string, number>();
  for (const tx of data.transactions) if (tx.categoryId) usage.set(tx.categoryId, (usage.get(tx.categoryId) ?? 0) + 1);
  return (
    <SettingsView
      user={{ name: user.name, email: user.email }}
      security={security}
      timeZone={data.timeZone}
      categories={data.categories.map((c) => ({ ...c, usage: usage.get(c.id) ?? 0 }))}
      accounts={data.accounts}
      imports={imports}
      rules={rules}
      counts={{ transactions: data.transactions.length, recurring: data.recurring.length, accounts: data.accounts.length }}
    />
  );
}
