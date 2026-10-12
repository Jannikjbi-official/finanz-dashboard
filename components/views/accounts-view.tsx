"use client";

import { ArrowsLeftRight, DotsThreeVertical, Plus } from "@phosphor-icons/react";
import { Button, Dropdown, Label } from "@heroui/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Money } from "@/components/ui/money";
import { PageHeader, Panel, SummaryCell } from "@/components/ui/panel";
import { useAction } from "@/lib/client/use-action";
import { ACCOUNT_KIND_LABEL } from "@/lib/domain/labels";
import { accountBalances, accountHistory } from "@/lib/domain/ledger";
import type { Account, Category, Transaction } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { deleteAccount, setAccountArchived } from "@/lib/server/actions/accounts";

const HISTORY_PAGE = 50;

export function AccountsView({ accounts, transactions, categories }: { accounts: Account[]; transactions: Transaction[]; categories: Category[] }) {
  const { openAccount, openTransaction } = useQuickAdd();
  const { run, pending } = useAction();
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(accounts.find((a) => !a.archived)?.id ?? null);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [limit, setLimit] = useState(HISTORY_PAGE);

  const balances = useMemo(() => accountBalances(accounts, transactions), [accounts, transactions]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const visibleAccounts = accounts.filter((a) => showArchived || !a.archived);
  const selected = accounts.find((a) => a.id === selectedId) ?? null;
  const history = useMemo(() => (selected ? accountHistory(selected, transactions) : []), [selected, transactions]);

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
            <p className="mx-auto mt-1 max-w-md text-muted">Girokonto, Sparkonto, Bargeld oder PayPal – jeweils mit dem Stand vor der ersten erfassten Buchung.</p>
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
        description="Kontostände aus Anfangssaldo und gebuchten Bewegungen"
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
                          if (key === "archive") void run(() => setAccountArchived(account.id, !account.archived));
                          if (key === "delete") setToDelete(account);
                        }}
                      >
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
          description={selected ? `${ACCOUNT_KIND_LABEL[selected.kind]} · ${history.length} Buchungen` : undefined}
          className="lg:col-span-7"
          bodyClassName=""
          action={
            selected ? (
              <Link href={`/transaktionen?konto=${selected.id}`} className="text-[13px] text-muted hover:text-foreground">
                In Transaktionen öffnen
              </Link>
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
                      <td className="py-2 text-muted">Anfangssaldo</td>
                      <td />
                      <td className="py-2 pl-3 pr-4 text-right sm:pr-5">
                        <Money cents={selected.startBalanceCents} tone="muted" />
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
