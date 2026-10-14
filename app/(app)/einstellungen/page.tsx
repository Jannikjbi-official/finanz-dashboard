import { SettingsView } from "@/components/views/settings-view";
import { getFinanceData, loadImports, loadRules, loadTemplates } from "@/lib/server/data";
import { getNotifySettings, maskWebhook } from "@/lib/server/notify";
import { getSecurityOverview } from "@/lib/server/security";
import { requireUser } from "@/lib/server/session";
import { listSnapshots } from "@/lib/server/restore";
import { listTrash } from "@/lib/server/trash";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [data, security, imports, rules, trash, snapshots, templates] = await Promise.all([
    getFinanceData(user.id),
    getSecurityOverview(),
    loadImports(user.id, "transactions"),
    loadRules(user.id),
    listTrash(user.id),
    listSnapshots(user.id),
    loadTemplates(user.id),
  ]);
  const notify = await getNotifySettings(user.id);
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
      trash={trash}
      snapshots={snapshots}
      templates={templates}
      rules={rules}
      notify={{ webhook: maskWebhook(notify.webhookUrl), due: notify.due, monthly: notify.monthly }}
      counts={{ transactions: data.transactions.length, recurring: data.recurring.length, accounts: data.accounts.length }}
    />
  );
}
