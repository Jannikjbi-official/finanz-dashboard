"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowsLeftRight, Bank, Coins, PiggyBank, Plus, Wallet } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/ui/button";
import { Empty, IconTile, PageHeader } from "@/ui/layout";
import { cx } from "@/ui/cx";
import { Money } from "@/ui/money";
import { AccountSheet, TransferSheet, type AccountView } from "./account-sheet";

const ICON: Record<AccountView["kind"], typeof Bank> = {
  giro: Bank,
  cash: Coins,
  savings: PiggyBank,
  other: Wallet,
};

const KIND_LABEL: Record<AccountView["kind"], string> = {
  giro: "Girokonto",
  cash: "Bargeld",
  savings: "Sparkonto",
  other: "Sonstiges",
};

export function AccountsView({
  accounts,
  today,
  unassigned,
}: {
  accounts: AccountView[];
  today: string;
  unassigned: number;
}) {
  const [editing, setEditing] = useState<AccountView | null>(null);
  const [creating, setCreating] = useState(false);
  const [transfer, setTransfer] = useState(false);

  const active = accounts.filter((a) => !a.archived);
  const groups = [
    { title: "Verfügbar", hint: "zählt zur Lage und Prognose", rows: active.filter((a) => a.liquid) },
    { title: "Rücklagen", hint: "Sparkonten und anderes, das nicht ausgegeben wird", rows: active.filter((a) => !a.liquid) },
    { title: "Archiviert", hint: null, rows: accounts.filter((a) => a.archived) },
  ].filter((group) => group.rows.length > 0);

  const total = active.reduce((sum, a) => sum + a.balanceCents, 0);
  const liquidTotal = active.filter((a) => a.liquid).reduce((sum, a) => sum + a.balanceCents, 0);

  return (
    <>
      <PageHeader
        title="Konten"
        description="Kontostände ergeben sich aus dem Startsaldo und allen Buchungen bis heute."
        actions={
          <>
            {active.length >= 2 ? (
              <Button onClick={() => setTransfer(true)}>
                <ArrowsLeftRight size={16} /> Umbuchen
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={15} weight="bold" /> Konto anlegen
            </Button>
          </>
        }
      />

      {accounts.length === 0 ? (
        <Empty
          title="Noch kein Konto."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Erstes Konto anlegen
            </Button>
          }
        >
          Mit Konten weißt du jederzeit, wo dein Geld liegt – und die Prognose startet vom echten Kontostand.
        </Empty>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Gesamtvermoegen mit Verteilung */}
          <section className="card">
            <p className="text-[13px] font-semibold text-ink-3">Gesamtvermögen auf Konten</p>
            <Money cents={total} className="mt-1 block text-[40px] font-extrabold leading-none tracking-[-0.045em] sm:text-[48px]" />
            {total > 0 ? (
              <>
                <div className="mt-5 flex h-3 gap-1 overflow-hidden rounded-full" aria-hidden>
                  {active
                    .filter((a) => a.balanceCents > 0)
                    .map((account) => (
                      <span key={account.id} className="h-full rounded-full" style={{ width: `${(account.balanceCents / total) * 100}%`, background: account.color }} />
                    ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
                  <span className="text-ink-2">
                    Verfügbar <Money cents={liquidTotal} whole className="font-bold text-ink" />
                  </span>
                  <span className="text-ink-2">
                    Rücklagen <Money cents={total - liquidTotal} whole className="font-bold text-ink" />
                  </span>
                </div>
              </>
            ) : null}
          </section>

          {groups.map((group) => (
            <section key={group.title}>
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="text-[17px] font-bold tracking-[-0.02em]">
                  {group.title}
                  {group.hint ? <span className="ml-2 text-[12px] font-medium text-ink-3">{group.hint}</span> : null}
                </h2>
                {group.title !== "Archiviert" ? (
                  <Money cents={group.rows.reduce((s, a) => s + a.balanceCents, 0)} whole className="text-[15px] font-bold" />
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.rows.map((account) => {
                  const Icon = ICON[account.kind];
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => setEditing(account)}
                      className={cx(
                        "group flex flex-col gap-6 rounded-[22px] border border-line bg-surface p-5 text-left transition-colors hover:border-line-strong",
                        account.archived && "opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <IconTile color={account.color}>
                          <Icon size={20} weight="bold" />
                        </IconTile>
                        <Link
                          href={`/app/geld/buchungen?konto=${account.id}&monat=alle`}
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-full bg-sunken px-3 py-1 text-[12px] font-semibold text-ink-2 hover:text-ink"
                        >
                          {account.transactionCount} Buchungen
                        </Link>
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold">{account.name}</p>
                        <p className="text-[12px] text-ink-3">{KIND_LABEL[account.kind]}</p>
                        <Money
                          cents={account.balanceCents}
                          className={cx("mt-3 block text-[26px] font-extrabold tracking-[-0.04em]", account.balanceCents < 0 && "text-neg")}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {unassigned > 0 ? (
            <p className="px-1 text-[13px] text-ink-3">
              {unassigned} Buchungen sind keinem Konto zugeordnet und fehlen in den Ständen.{" "}
              <Link href="/app/geld/buchungen?konto=none&monat=alle" className="font-semibold text-accent hover:underline">
                Zuordnen
              </Link>
            </p>
          ) : null}
        </div>
      )}

      <AccountSheet key={editing?.id ?? "none"} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} account={editing} />
      <AccountSheet key={creating ? "new-open" : "new"} open={creating} onOpenChange={setCreating} />
      <TransferSheet open={transfer} onOpenChange={setTransfer} accounts={accounts} today={today} />
    </>
  );
}
