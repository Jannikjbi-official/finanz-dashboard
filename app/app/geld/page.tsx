import { requireUser } from "@/lib/session";
import { accounts, transactions } from "@/lib/mongo";
import { getAccountBalances } from "@/lib/server/finance";
import { getSettings } from "@/lib/server/user-data";
import { todayIn } from "@/lib/domain/calendar";
import { AccountsView } from "@/features/geld/accounts-view";

export const metadata = { title: "Konten" };

export default async function KontenPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timeZone);

  const [balances, docs, unassigned] = await Promise.all([
    getAccountBalances(user.id, today),
    accounts.find({ userId: user.id }, { projection: { startBalanceCents: 1 } }).toArray(),
    transactions.countDocuments({ userId: user.id, $or: [{ accountId: null }, { accountId: { $exists: false } }] }),
  ]);

  const startById = new Map(docs.map((doc) => [doc._id.toString(), doc.startBalanceCents]));

  return (
    <AccountsView
      today={today}
      unassigned={balances.length > 0 ? unassigned : 0}
      accounts={balances.map((account) => ({
        ...account,
        startBalanceCents: startById.get(account.id) ?? 0,
      }))}
    />
  );
}
