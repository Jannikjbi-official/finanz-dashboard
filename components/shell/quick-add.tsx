"use client";

import { toast } from "@heroui/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccountDialog } from "@/components/forms/account-dialog";
import { RecurringDialog } from "@/components/forms/recurring-dialog";
import { TransactionDialog, type DialogKind, type Lookups } from "@/components/forms/transaction-dialog";
import type { Account, CostType, Interval, Recurring, Transaction, TxType } from "@/lib/domain/types";

/** Vorbelegung fuer neue regelmaessige Zahlungen (z. B. aus einer erkannten Zahlung). */
export type RecurringDefaults = {
  type?: TxType;
  costType?: CostType;
  title?: string;
  amountCents?: number;
  interval?: Interval;
  nextDue?: string;
  accountId?: string | null;
};

type DialogState =
  | { kind: "transaction"; initialKind: DialogKind; transaction: Transaction | null; duplicateOf?: Transaction | null; key: number }
  | { kind: "recurring"; entry: Recurring | null; defaults?: RecurringDefaults; key: number }
  | { kind: "account"; account: Account | null; key: number }
  | null;

type QuickAdd = {
  lookups: Lookups;
  openTransaction: (initialKind?: DialogKind, transaction?: Transaction | null, options?: { duplicateOf?: Transaction }) => void;
  openRecurring: (entry?: Recurring | null, defaults?: RecurringDefaults) => void;
  openAccount: (account?: Account | null) => void;
};

const Context = createContext<QuickAdd | null>(null);

/**
 * Zentrale Dialoge: Erfassen und Bearbeiten ist von ueberall erreichbar,
 * ohne dass jede Seite eigene Kopien der Formulare haelt.
 */
export function QuickAddProvider({ lookups, children }: { lookups: Lookups; children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback((next: NonNullable<DialogState>) => {
    setDialog(next);
    setOpen(true);
  }, []);

  const value = useMemo<QuickAdd>(
    () => ({
      lookups,
      openTransaction: (initialKind = "expense", transaction = null, options) => {
        // Ohne Konto keine Buchung: zuerst ein Konto anlegen
        if (!transaction && !lookups.accounts.some((account) => !account.archived)) {
          toast.info("Lege zuerst ein Konto an – jede Buchung gehört zu einem Konto.");
          show({ kind: "account", account: null, key: Date.now() });
          return;
        }
        show({ kind: "transaction", initialKind, transaction, duplicateOf: options?.duplicateOf ?? null, key: Date.now() });
      },
      openRecurring: (entry = null, defaults) => show({ kind: "recurring", entry, defaults, key: Date.now() }),
      openAccount: (account = null) => show({ kind: "account", account, key: Date.now() }),
    }),
    [lookups, show],
  );

  // App-Verknuepfungen ("Ausgabe erfassen" am App-Symbol): ?erfassen=ausgabe|einnahme|transfer
  useEffect(() => {
    const url = new URL(window.location.href);
    const kind = { ausgabe: "expense", einnahme: "income", transfer: "transfer" }[url.searchParams.get("erfassen") ?? ""] as DialogKind | undefined;
    if (!url.searchParams.has("erfassen")) return;
    url.searchParams.delete("erfassen");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    if (kind) value.openTransaction(kind);
    // Nur beim Start der App
  }, []);

  return (
    <Context.Provider value={value}>
      {children}
      {dialog?.kind === "transaction" && (
        <TransactionDialog
          key={dialog.key}
          isOpen={open}
          onOpenChange={setOpen}
          lookups={lookups}
          initialKind={dialog.initialKind}
          transaction={dialog.transaction}
          duplicateOf={dialog.duplicateOf}
        />
      )}
      {dialog?.kind === "recurring" && (
        <RecurringDialog
          key={dialog.key}
          isOpen={open}
          onOpenChange={setOpen}
          lookups={lookups}
          entry={dialog.entry}
          defaults={dialog.defaults}
        />
      )}
      {dialog?.kind === "account" && <AccountDialog key={dialog.key} isOpen={open} onOpenChange={setOpen} account={dialog.account} />}
    </Context.Provider>
  );
}

export function useQuickAdd() {
  const context = useContext(Context);
  if (!context) throw new Error("useQuickAdd ausserhalb von QuickAddProvider");
  return context;
}
