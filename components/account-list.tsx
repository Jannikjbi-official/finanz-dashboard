"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  addToast,
} from "@heroui/react";
import { deleteAccount } from "@/lib/actions";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/icon";
import { AccountDialog } from "@/components/account-dialog";
import { ACCOUNT_KIND_LABEL, type Account } from "@/lib/types";

export function AccountList({ accounts }: { accounts: Account[] }) {
  const [editing, setEditing] = useState<Account | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(account: Account) {
    const warning =
      account.transactionCount > 0
        ? `„${account.name}" löschen? ${account.transactionCount} Buchungen bleiben erhalten, verlieren aber die Kontozuordnung.`
        : `„${account.name}" löschen?`;

    if (!window.confirm(warning)) return;

    const formData = new FormData();
    formData.set("id", account.id);

    startTransition(async () => {
      const result = await deleteAccount({ ok: true }, formData);
      addToast({
        title: result.error ?? result.message ?? "Gelöscht",
        color: result.error ? "danger" : "success",
      });
    });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex flex-col gap-3 rounded-2xl border border-default-100/80 bg-content1/50 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                  style={{ backgroundColor: `${account.color}1f` }}
                >
                  {account.icon || "•"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{account.name}</p>
                  <p className="text-tiny text-default-400">
                    {ACCOUNT_KIND_LABEL[account.kind]} · {account.transactionCount}{" "}
                    Buchungen
                  </p>
                </div>
              </div>

              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    isDisabled={pending}
                    aria-label={`Aktionen für ${account.name}`}
                  >
                    <Icon name="more" size={18} />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Aktionen">
                  <DropdownItem key="edit" onPress={() => setEditing(account)}>
                    Bearbeiten
                  </DropdownItem>
                  <DropdownItem
                    key="delete"
                    color="danger"
                    className="text-danger"
                    onPress={() => remove(account)}
                  >
                    Löschen
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>

            <div>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  account.balanceCents < 0 ? "text-danger" : ""
                }`}
              >
                {formatMoney(account.balanceCents)}
              </p>
              <p className="text-tiny text-default-400">
                Start {formatMoney(account.startBalanceCents)}
                {account.balanceCents !== account.startBalanceCents
                  ? ` · ${formatMoney(
                      account.balanceCents - account.startBalanceCents,
                    )} Bewegung`
                  : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <AccountDialog
          key={editing.id}
          account={editing}
          isOpen
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}
