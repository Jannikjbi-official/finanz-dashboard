"use client";

import { Button, Label, ToggleButton, ToggleButtonGroup, type Key } from "@heroui/react";
import { useState } from "react";
import { formatAmountInput, formatDate } from "@/lib/format";
import { useAction } from "@/lib/client/use-action";
import type { Account, Category, Transaction, TxStatus, TxType } from "@/lib/domain/types";
import { unlinkRecurringPayment } from "@/lib/server/actions/matching";
import { ruleFromTransaction } from "@/lib/server/actions/rules";
import { deleteTransaction, saveTransaction, saveTransfer } from "@/lib/server/actions/transactions";
import { ConfirmDialog } from "./confirm-dialog";
import { DateInput, MoneyInput, NoteInput, SelectInput, TextInput } from "./fields";
import { FormDialog } from "./form-dialog";

export type DialogKind = TxType | "transfer";

export type Lookups = { accounts: Account[]; categories: Category[]; today: string };

/** Auswahlgruppe mit zwei bis drei Optionen. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ id: T; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set<Key>([value])}
        onSelectionChange={(keys) => {
          const [next] = [...keys];
          if (next) onChange(String(next) as T);
        }}
        size="sm"
        fullWidth
        aria-label={label}
      >
        {options.map((option) => (
          <ToggleButton key={option.id} id={option.id}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

/**
 * Erfassen und Bearbeiten von Einnahmen, Ausgaben und Transfers.
 * Bewusst kurz: Betrag, Beschreibung, Datum, Konto - der Rest ist optional.
 */
export function TransactionDialog({
  isOpen,
  onOpenChange,
  lookups,
  initialKind = "expense",
  transaction,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lookups: Lookups;
  initialKind?: DialogKind;
  transaction?: Transaction | null;
}) {
  const accounts = lookups.accounts.filter((account) => !account.archived || account.id === transaction?.accountId);
  const defaultAccount = accounts.find((account) => account.kind === "giro" && !account.archived) ?? accounts[0];

  const [kind, setKind] = useState<DialogKind>(transaction ? transaction.type : initialKind);
  const [status, setStatus] = useState<TxStatus>(transaction?.status ?? "booked");
  const [amount, setAmount] = useState(transaction ? formatAmountInput(transaction.amountCents) : "");
  const [title, setTitle] = useState(transaction?.title ?? "");
  const [date, setDate] = useState<string | null>(transaction?.date ?? lookups.today);
  const [accountId, setAccountId] = useState<string | null>(transaction?.accountId ?? defaultAccount?.id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(accounts.find((account) => account.id !== defaultAccount?.id)?.id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null);
  const [note, setNote] = useState(transaction?.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending } = useAction();

  const isEdit = Boolean(transaction);
  const type: TxType = kind === "income" ? "income" : "expense";
  const categories = lookups.categories.filter((category) => category.kind === type);

  const submit = () => {
    if (kind === "transfer") {
      return run(() =>
        saveTransfer({ fromAccountId: accountId ?? "", toAccountId: toAccountId ?? "", amount, date: date ?? "", note }),
      );
    }
    return run(() =>
      saveTransaction({
        id: transaction?.id ?? null,
        type,
        status,
        amount,
        date: date ?? "",
        title,
        note,
        categoryId,
        accountId: accountId ?? "",
      }),
    );
  };

  const accountOptions = accounts.map((account) => ({ id: account.id, label: account.name + (account.archived ? " (archiviert)" : "") }));
  const title_ = isEdit
    ? "Buchung bearbeiten"
    : kind === "transfer"
      ? "Transfer zwischen Konten"
      : kind === "income"
        ? "Einnahme erfassen"
        : "Ausgabe erfassen";

  return (
    <>
      <FormDialog
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title={title_}
        description={kind === "transfer" ? "Verschiebt Geld zwischen eigenen Konten. Zählt weder als Einnahme noch als Ausgabe." : undefined}
        pending={pending}
        onSubmit={submit}
        extraActions={
          isEdit ? (
            <Button variant="danger-soft" size="sm" onPress={() => setConfirmDelete(true)}>
              Löschen
            </Button>
          ) : undefined
        }
      >
        {!isEdit && (
          <Segmented
            label="Art"
            value={kind}
            onChange={setKind}
            options={[
              { id: "expense", label: "Ausgabe" },
              { id: "income", label: "Einnahme" },
              { id: "transfer", label: "Transfer" },
            ]}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoneyInput label="Betrag" value={amount} onChange={setAmount} autoFocus />
          <DateInput label="Datum" value={date} onChange={setDate} isRequired />
        </div>

        {kind === "transfer" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectInput label="Von Konto" value={accountId} onChange={setAccountId} options={accountOptions} isRequired />
            <SelectInput label="Auf Konto" value={toAccountId} onChange={setToAccountId} options={accountOptions} isRequired />
          </div>
        ) : (
          <>
            <TextInput
              label="Beschreibung"
              value={title}
              onChange={setTitle}
              placeholder={type === "income" ? "z. B. Gehalt Oktober" : "z. B. Wocheneinkauf"}
              isRequired
              maxLength={120}
            />
            <Segmented
              label="Status"
              value={status}
              onChange={setStatus}
              options={
                type === "income"
                  ? [
                      { id: "booked", label: "Eingegangen" },
                      { id: "pending", label: "Erwartet" },
                    ]
                  : [
                      { id: "booked", label: "Bezahlt" },
                      { id: "pending", label: "Geplant" },
                    ]
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectInput label="Konto" value={accountId} onChange={setAccountId} options={accountOptions} isRequired />
              <SelectInput
                label="Kategorie"
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Ohne Kategorie"
                options={[{ id: "none", label: "Ohne Kategorie" }, ...categories.map((category) => ({ id: category.id, label: category.name }))]}
              />
            </div>
          </>
        )}
        <NoteInput value={note} onChange={setNote} />
        {transaction && !transaction.transferGroupId && transaction.categoryId && transaction.categoryId === categoryId && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label font-normal">Künftige Buchungen mit „{transaction.title}“ automatisch so einordnen?</p>
            <Button size="sm" variant="ghost" isPending={pending} onPress={() => run(() => ruleFromTransaction(transaction.id))}>
              Immer so kategorisieren
            </Button>
          </div>
        )}
        {transaction?.recurringId && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label font-normal">
              Diese Buchung gehört zu einer regelmäßigen Zahlung{transaction.recurringDue ? ` (Termin ${formatDate(transaction.recurringDue)})` : ""}.
            </p>
            <Button
              size="sm"
              variant="ghost"
              isPending={pending}
              onPress={async () => {
                if (await run(() => unlinkRecurringPayment(transaction.id))) onOpenChange(false);
              }}
            >
              Zuordnung lösen
            </Button>
          </div>
        )}
      </FormDialog>

      {transaction && (
        <ConfirmDialog
          isOpen={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={transaction.transferGroupId ? "Transfer löschen?" : "Buchung löschen?"}
          confirmLabel="Löschen"
          pending={pending}
          onConfirm={async () => {
            const done = await run(() => deleteTransaction(transaction.id));
            if (done) onOpenChange(false);
            return done;
          }}
        >
          <p>
            „{transaction.title}“ wird endgültig gelöscht.
            {transaction.transferGroupId && " Beide Seiten des Transfers werden entfernt."}
            {transaction.recurringId && " War es die letzte Zahlung einer regelmäßigen Zahlung, wird dieser Termin wieder offen."}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
