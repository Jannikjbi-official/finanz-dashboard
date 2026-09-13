import { Alert } from "@heroui/react";
import { requireUser } from "@/lib/session";
import { countTransactionsWithoutAccount, getAccounts } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { AccountDialog } from "@/components/account-dialog";
import { AccountList } from "@/components/account-list";
import { TransferDialog } from "@/components/transfer-dialog";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/ui";

export default async function AccountsPage() {
  const user = await requireUser();
  const [accounts, withoutAccount] = await Promise.all([
    getAccounts(user.id),
    countTransactionsWithoutAccount(user.id),
  ]);

  const total = accounts.reduce((sum, account) => sum + account.balanceCents, 0);
  const positive = accounts.filter((account) => account.balanceCents >= 0);
  const negative = accounts.filter((account) => account.balanceCents < 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Konten"
        description="Kontostände und dein Gesamtvermögen."
        actions={
          <>
            <TransferDialog accounts={accounts} />
            <AccountDialog />
          </>
        }
      />

      {accounts.length === 0 ? (
        <SectionCard>
          <EmptyState
            title="Noch keine Konten angelegt."
            hint="Lege dein Girokonto mit dem aktuellen Kontostand als Startsaldo an. Buchungen kannst du danach einem Konto zuordnen."
            action={<AccountDialog />}
          />
        </SectionCard>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Gesamtvermögen"
              value={formatMoney(total)}
              hint={`${accounts.length} Konten`}
              tone={total >= 0 ? "success" : "danger"}
            />
            <StatCard
              label="Guthaben"
              value={formatMoney(
                positive.reduce((sum, account) => sum + account.balanceCents, 0),
              )}
              hint={`${positive.length} Konten im Plus`}
            />
            <StatCard
              label="Im Minus"
              value={formatMoney(
                Math.abs(
                  negative.reduce((sum, account) => sum + account.balanceCents, 0),
                ),
              )}
              hint={
                negative.length > 0
                  ? negative.map((account) => account.name).join(", ")
                  : "kein Konto im Minus"
              }
              tone={negative.length > 0 ? "danger" : "muted"}
            />
          </section>

          {withoutAccount > 0 ? (
            <Alert
              color="default"
              variant="flat"
              title={`${withoutAccount} Buchungen ohne Konto`}
              description="Sie zählen nicht in die Kontostände. Du kannst sie beim Bearbeiten einem Konto zuordnen."
            />
          ) : null}

          <AccountList accounts={accounts} />
        </>
      )}
    </div>
  );
}
