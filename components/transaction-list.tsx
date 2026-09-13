"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  addToast,
} from "@heroui/react";
import { deleteTransaction, type ActionState } from "@/lib/actions";
import { formatPeriod } from "@/lib/money";
import { Amount, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icon";
import { TransactionDialog } from "@/components/transaction-dialog";
import type { Category, Transaction } from "@/lib/types";
import type { Account } from "@/lib/types";

/**
 * Bewusst kein Table-Layout: als Liste bleibt es auf dem Handy lesbar und
 * auf dem Desktop trotzdem spaltig ausgerichtet.
 */
export function TransactionList({
  rows,
  categories,
  accounts = [],
  emptyTitle = "Keine Buchungen in diesem Monat.",
  emptyHint,
  showDate = true,
}: {
  rows: Transaction[];
  categories: Category[];
  accounts?: Account[];
  emptyTitle?: string;
  emptyHint?: string;
  showDate?: boolean;
}) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(tx: Transaction) {
    if (!window.confirm(`„${tx.title}" wirklich löschen?`)) return;

    const formData = new FormData();
    formData.set("id", tx.id);

    startTransition(async () => {
      const result: ActionState = await deleteTransaction({ ok: true }, formData);
      addToast({
        title: result.error ?? result.message ?? "Gelöscht",
        color: result.error ? "danger" : "success",
      });
    });
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-default-100/70">
        {rows.map((tx) => {
          const category = tx.categoryId ? byId.get(tx.categoryId) : undefined;
          const account = tx.accountId ? accountById.get(tx.accountId) : undefined;

          return (
            <li key={tx.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ backgroundColor: `${category?.color ?? "#64748b"}1f` }}
              >
                {category?.icon || (tx.type === "income" ? "↓" : "↑")}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="truncate">{tx.title}</span>
                  {tx.recurringId ? (
                    <Chip size="sm" variant="flat" className="h-5 text-[0.65rem]">
                      Abo
                    </Chip>
                  ) : null}
                  {tx.datePrecision !== "day" ? (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="warning"
                      className="h-5 text-[0.65rem]"
                    >
                      {tx.datePrecision === "month" ? "ganzer Monat" : "Zeitraum"}
                    </Chip>
                  ) : null}
                </p>

                <p className="flex flex-wrap items-center gap-x-1.5 text-tiny text-default-400">
                  {showDate ? (
                    <span>
                      {formatPeriod(tx.date, tx.dateEnd, tx.datePrecision)}
                    </span>
                  ) : null}

                  <span aria-hidden>·</span>
                  {category ? (
                    <span style={{ color: category.color }}>{category.name}</span>
                  ) : (
                    <span>Ohne Kategorie</span>
                  )}

                  {account ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{account.name}</span>
                    </>
                  ) : null}
                </p>

                {tx.note ? (
                  <p className="mt-0.5 line-clamp-2 text-tiny text-default-500">
                    {tx.note}
                  </p>
                ) : null}
              </div>

              <Amount
                cents={tx.amountCents}
                kind={tx.type}
                className="mt-0.5 shrink-0 text-sm font-medium"
              />

              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    isDisabled={pending}
                    aria-label={`Aktionen für ${tx.title}`}
                  >
                    <Icon name="more" size={18} />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Aktionen">
                  <DropdownItem key="edit" onPress={() => setEditing(tx)}>
                    Bearbeiten
                  </DropdownItem>
                  <DropdownItem
                    key="delete"
                    color="danger"
                    className="text-danger"
                    onPress={() => remove(tx)}
                  >
                    Löschen
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </li>
          );
        })}
      </ul>

      {editing ? (
        <TransactionDialog
          key={editing.id}
          categories={categories}
          accounts={accounts}
          transaction={editing}
          isOpen
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}
