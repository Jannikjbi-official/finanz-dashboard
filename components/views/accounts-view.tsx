"use client";

import { ArrowsLeftRight, DotsThreeVertical, Plus } from "@phosphor-icons/react";
import { Button, Dropdown, Label } from "@heroui/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DateInput, MoneyInput } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { BalanceChart } from "@/components/charts/balance-chart";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Money } from "@/components/ui/money";
import { PageHeader, Panel, SummaryCell } from "@/components/ui/panel";
import { useAction } from "@/lib/client/use-action";
import { ACCOUNT_KIND_LABEL } from "@/lib/domain/labels";
import { accountBalance, accountBalances, accountHistory, openingBalance } from "@/lib/domain/ledger";
import { netWorthHistory } from "@/lib/domain/timeline";
import type { Account, Category, Transaction } from "@/lib/domain/types";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { parseAmountToCents } from "@/lib/money";
import { deleteAccount, setAccountArchived, setBalanceAnchor } from "@/lib/server/actions/accounts";

const HISTORY_PAGE = 50;

export function AccountsView({ accounts, transactions, categories }: { accounts: Account[]; transactions: Transaction[]; categories: Category[] }) {
  const { openAccount, openTransaction, lookups } = useQuickAdd();
  const [reconcile, setReconcile] = useState<Account | null>(null);
  const { run, pending } = useAction();
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(accounts.find((a) => !a.archived)?.id ?? null);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [limit, setLimit] = useState(HISTORY_PAGE);

  const balances = useMemo(() => accountBalances(accounts, transactions, lookups.today), [accounts, transactions, lookups.today]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const visibleAccounts = accounts.filter((a) => showArchived || !a.archived);
  const selected = accounts.find((a) => a.id === selectedId) ?? null;
  const history = useMemo(() => (selected ? accountHistory(selected, transactions) : []), [selected, transactions]);

  const worth = useMemo(() => netWorthHistory(accounts, transactions, lookups.today), [accounts, transactions, lookups.today]);
  const active = accounts.filter((a) => !a.archived);
  const total = active.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);
  const liquid = active.filter((a) => a.liquid).reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader title="Konten" />
        <Panel>
          <div className="py-8 text-center">
            <p className="font-medium">Noch keine Konten</p>
            <p className="mx-auto mt-1 max-w-md text-muted">Girokonto, Sparkonto, Bargeld oder PayPal – jeweils mit dem Kontostand laut Bank und dem Tag, für den er gilt.</p>
            <Button className="mt-4" onPress={() => openAccount()}>
              Konto anlegen
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Konten"
        description="Kontostände aus dem abgeglichenen Stand laut Bank und den gebuchten Bewegungen"
        actions={
          <>
            <Button size="sm" variant="secondary" onPress={() => openTransaction("transfer")} isDisabled={active.length < 2}>
              <ArrowsLeftRight className="size-4" /> Transfer
            </Button>
            <Button size="sm" onPress={() => openAccount()}>
              <Plus weight="bold" className="size-4" /> Konto anlegen
            </Button>
          </>
        }
      />

      <section className="panel mb-4 grid grid-cols-2 md:grid-cols-3 md:divide-x md:divide-separator" aria-label="Summen">
        <SummaryCell label="Gesamt" hint={`${active.length} ${active.length === 1 ? "Konto" : "Konten"}`} value={<Money cents={total} />} />
        <SummaryCell label="Verfügbar" hint="Konten für laufende Ausgaben" value={<Money cents={liquid} />} />
        <SummaryCell label="Zurückgelegt" hint="zählt nicht zum verfügbaren Geld" value={<Money cents={total - liquid} />} />
      </section>

      {worth.length > 2 && (
        <Panel title="Vermögensverlauf" description="Alle Konten jeweils am Monatsende, zuletzt heute" className="mb-4">
          <BalanceChart
            points={worth.map((point) => ({
              date: point.date,
              value: point.total,
              label: point.current ? "Heute" : `Ende ${formatMonth(point.date.slice(0, 7))}`,
              note: `davon verfügbar ${formatMoney(point.liquid)}`,
            }))}
            step={false}
            height={180}
            label="Vermögen je Monatsende"
          />
        </Panel>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <Panel
          title="Konten"
          className="lg:col-span-5"
          bodyClassName=""
          action={
            accounts.some((a) => a.archived) ? (
              <Button size="sm" variant="ghost" onPress={() => setShowArchived((v) => !v)}>
                {showArchived ? "Archivierte ausblenden" : "Archivierte zeigen"}
              </Button>
            ) : undefined
          }
        >
          <ul className="rows">
            {visibleAccounts.map((account) => {
              const isSelected = account.id === selectedId;
              return (
                <li key={account.id} className={`flex items-center gap-2 pr-2 ${isSelected ? "bg-surface-secondary" : ""}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(account.id);
                      setLimit(HISTORY_PAGE);
                    }}
                    aria-pressed={isSelected}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-secondary sm:px-5"
                  >
                    <span className="min-w-0">
                      <span className={`block truncate font-medium ${account.archived ? "text-muted" : ""}`}>{account.name}</span>
                      <span className="label block font-normal">
                        {ACCOUNT_KIND_LABEL[account.kind]}
                        {!account.liquid && " · zurückgelegt"}
                        {account.archived && " · archiviert"}
                      </span>
                    </span>
                    <Money cents={balances.get(account.id) ?? 0} className="font-semibold" />
                  </button>
                  <Dropdown>
                    <Button size="sm" variant="ghost" isIconOnly aria-label={`Aktionen für ${account.name}`} className="size-7 min-w-7">
                      <DotsThreeVertical weight="bold" className="size-4" />
                    </Button>
                    <Dropdown.Popover placement="bottom end">
                      <Dropdown.Menu
                        onAction={(key) => {
                          if (key === "edit") openAccount(account);
                          if (key === "reconcile") setReconcile(account);
                          if (key === "archive") void run(() => setAccountArchived(account.id, !account.archived));
                          if (key === "delete") setToDelete(account);
                        }}
                      >
                        <Dropdown.Item id="reconcile" textValue="Kontostand abgleichen">
                          <Label>Kontostand abgleichen …</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="edit" textValue="Bearbeiten">
                          <Label>Bearbeiten</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="archive" textValue="Archivieren">
                          <Label>{account.archived ? "Wiederherstellen" : "Archivieren"}</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="delete" textValue="Löschen" variant="danger">
                          <Label>Löschen …</Label>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title={selected ? selected.name : "Kontoverlauf"}
          description={
            selected
              ? `${ACCOUNT_KIND_LABEL[selected.kind]} · ${history.length} Buchungen · ${
                  selected.balanceAnchor
                    ? `abgeglichen: ${formatMoney(selected.balanceAnchor.amountCents)} am ${formatDate(selected.balanceAnchor.date)}`
                    : "noch nicht mit der Bank abgeglichen"
                }`
              : undefined
          }
          className="lg:col-span-7"
          bodyClassName=""
          action={
            selected ? (
              <>
                <Button size="sm" variant="secondary" onPress={() => setReconcile(selected)}>
                  Kontostand abgleichen
                </Button>
                <Link href={`/transaktionen?konto=${selected.id}`} className="hidden text-[13px] text-muted hover:text-foreground sm:inline">
                  In Transaktionen öffnen
                </Link>
              </>
            ) : undefined
          }
        >
          {!selected ? (
            <p className="px-5 py-8 text-center text-muted">Wähle ein Konto, um den Verlauf zu sehen.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="label border-b border-separator">
                    <th className="py-2 pl-4 text-left font-medium sm:pl-5">Datum</th>
                    <th className="py-2 text-left font-medium">Buchung</th>
                    <th className="py-2 text-right font-medium">Betrag</th>
                    <th className="py-2 pl-3 pr-4 text-right font-medium sm:pr-5">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, limit).map(({ tx, balanceAfter }) => (
                    <tr key={tx.id} className="border-b border-separator">
                      <td className="whitespace-nowrap py-2 pl-4 text-muted sm:pl-5">{formatDate(tx.date)}</td>
                      <td className="py-2 pr-3">
                        <div className="truncate">{tx.title}</div>
                        <div className="label font-normal">{tx.transferGroupId ? "Transfer" : tx.categoryId ? categoryName.get(tx.categoryId) : ""}</div>
                      </td>
                      <td className="whitespace-nowrap py-2 text-right">
                        <Money cents={tx.type === "income" ? tx.amountCents : -tx.amountCents} signed tone="plain" className={tx.type === "income" && !tx.transferGroupId ? "text-success" : ""} />
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 pr-4 text-right sm:pr-5">
                        <Money cents={balanceAfter} tone={balanceAfter < 0 ? "auto" : "muted"} />
                      </td>
                    </tr>
                  ))}
                  {history.length <= limit && (
                    <tr>
                      <td className="py-2 pl-4 text-muted sm:pl-5">–</td>
                      <td className="py-2 text-muted">{selected.balanceAnchor ? "Stand vor der ersten Buchung (aus dem Abgleich)" : "Anfangssaldo"}</td>
                      <td />
                      <td className="py-2 pl-3 pr-4 text-right sm:pr-5">
                        <Money cents={openingBalance(selected, transactions)} tone="muted" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {history.length > limit && (
                <div className="py-3 text-center">
                  <Button size="sm" variant="ghost" onPress={() => setLimit((v) => v + HISTORY_PAGE)}>
                    Ältere anzeigen
                  </Button>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {reconcile && (
        <ReconcileDialog key={reconcile.id} account={reconcile} transactions={transactions} today={lookups.today} onClose={() => setReconcile(null)} />
      )}

      <ConfirmDialog
        isOpen={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`${toDelete?.name ?? ""} löschen?`}
        confirmLabel="Konto löschen"
        pending={pending}
        onConfirm={() => run(() => deleteAccount(toDelete!.id))}
      >
        <p>Konten mit Buchungen oder regelmäßigen Zahlungen lassen sich nicht löschen, damit keine Historie verloren geht. Archiviere sie stattdessen.</p>
      </ConfirmDialog>
    </div>
  );
}

/**
 * Kontostand abgleichen: Stand laut Bank eingeben, die Differenz zum
 * berechneten Stand an diesem Tag wird sofort angezeigt.
 */
function ReconcileDialog({
  account,
  transactions,
  today,
  onClose,
}: {
  account: Account;
  transactions: Transaction[];
  today: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const { run, pending } = useAction();
  const [date, setDate] = useState<string | null>(today);
  const [balance, setBalance] = useState("");
  const computed = accountBalance(account, transactions, date ?? today);
  const entered = parseSigned(balance);

  return (
    <FormDialog
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title={`${account.name}: Kontostand abgleichen`}
      description="Trag den Kontostand laut Bank ein – gebuchter Stand am Ende des Tages, ohne vorgemerkte Umsätze. Ab dann rechnet das Konto von hier aus."
      submitLabel="Kontostand übernehmen"
      pending={pending}
      onSubmit={() => run(() => setBalanceAnchor({ accountId: account.id, balance, date }))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Kontostand laut Bank" value={balance} onChange={setBalance} allowNegative autoFocus />
        <DateInput label="Stand am" value={date} onChange={setDate} isRequired />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-[var(--radius)] bg-surface-secondary px-3 py-2.5 text-[13px]">
        <dt className="text-muted">Laut Portal am {date ? formatDate(date) : "–"}</dt>
        <dd className="text-right">
          <Money cents={computed} />
        </dd>
        {entered !== null && (
          <>
            <dt className="text-muted">Differenz</dt>
            <dd className={`text-right ${entered - computed === 0 ? "text-success" : ""}`}>
              {entered - computed === 0 ? "stimmt überein" : <Money cents={entered - computed} signed />}
            </dd>
          </>
        )}
      </dl>
      {account.balanceAnchor && (
        <p className="label font-normal">
          Bisher abgeglichen: {formatMoney(account.balanceAnchor.amountCents)} am {formatDate(account.balanceAnchor.date)}. Der neue Stand ersetzt ihn.
        </p>
      )}
    </FormDialog>
  );
}

/** "1.234,56" / "-12,50" in Cent, sonst null (nur fuer die Anzeige der Differenz). */
function parseSigned(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cents = parseAmountToCents(trimmed.replace(/^[-−]\s*/, ""));
  if (cents === null) return null;
  return /^[-−]/.test(trimmed) ? -cents : cents;
}
