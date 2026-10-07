"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowsLeftRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/ui/button";
import { Empty, PageHeader, Swatch } from "@/ui/layout";
import { Money } from "@/ui/money";
import { AccountSheet, TransferSheet, type AccountView } from "./account-sheet";

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
        <div className="flex flex-col gap-8">
          {groups.map((group) => {
            const sum = group.rows.reduce((s, a) => s + a.balanceCents, 0);
            return (
              <section key={group.title}>
                <div className="flex items-baseline justify-between border-b border-ink/80 pb-2">
                  <h2 className="text-[15px] font-semibold">
                    {group.title}
                    {group.hint ? <span className="ml-2 text-[12px] font-normal text-ink-3">{group.hint}</span> : null}
                  </h2>
                  {group.title !== "Archiviert" ? <Money cents={sum} className="text-[15px] font-semibold" /> : null}
                </div>
                <table className="w-full text-[14px]">
                  <thead className="sr-only">
                    <tr>
                      <th>Konto</th>
                      <th>Buchungen</th>
                      <th>Stand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((account) => (
                      <tr
                        key={account.id}
                        onClick={() => setEditing(account)}
                        className="cursor-pointer border-b border-line hover:bg-sunken/60"
                      >
                        <td className="py-3.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <Swatch color={account.color} className="size-2.5" />
                            <span className="font-medium">{account.name}</span>
                          </div>
                          <p className="ml-5 text-[12px] text-ink-3">{KIND_LABEL[account.kind]}</p>
                        </td>
                        <td className="hidden py-3.5 pr-3 text-right text-[13px] text-ink-3 sm:table-cell">
                          <Link
                            href={`/app/geld/buchungen?konto=${account.id}&monat=alle`}
                            onClick={(event) => event.stopPropagation()}
                            className="hover:text-ink hover:underline"
                          >
                            {account.transactionCount} Buchungen
                          </Link>
                        </td>
                        <td className="w-40 py-3.5 text-right">
                          <Money cents={account.balanceCents} className={account.balanceCents < 0 ? "text-neg" : undefined} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}

          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t-2 border-ink pt-3">
            <p className="text-[14px] font-semibold">Gesamtvermögen auf Konten</p>
            <Money cents={total} className="text-[20px] font-semibold" />
          </div>

          {unassigned > 0 ? (
            <p className="text-[13px] text-ink-3">
              {unassigned} Buchungen sind keinem Konto zugeordnet und fehlen in den Ständen.{" "}
              <Link href="/app/geld/buchungen?konto=none&monat=alle" className="text-accent hover:underline">
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
