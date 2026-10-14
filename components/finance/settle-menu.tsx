"use client";

import { DotsThreeVertical } from "@phosphor-icons/react";
import { Button, Dropdown, Label } from "@heroui/react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DateInput, MoneyInput, SelectInput } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { useQuickAdd } from "@/components/shell/quick-add";
import { useAction } from "@/lib/client/use-action";
import { formatAmountInput, formatDate, formatDayShort, formatMoney } from "@/lib/format";
import type { OpenItem } from "@/lib/domain/overview";
import type { Recurring, Transaction } from "@/lib/domain/types";
import { findLinkCandidates, linkRecurringPayment, type LinkCandidate } from "@/lib/server/actions/matching";
import { settleRecurring } from "@/lib/server/actions/recurring";
import { setTransactionStatus } from "@/lib/server/actions/transactions";

/**
 * Aktionen fuer einen offenen Posten: als bezahlt/eingegangen buchen (ein
 * Klick oder mit abweichenden Angaben) oder - bei regelmaessigen Zahlungen -
 * ueberspringen, z. B. wenn sie schon per CSV importiert wurde.
 */
export function SettleMenu({ item, recurring, transaction }: { item: OpenItem; recurring?: Recurring; transaction?: Transaction }) {
  const { lookups, openTransaction, openRecurring } = useQuickAdd();
  const { run, pending } = useAction();
  const [dialog, setDialog] = useState<"details" | "skip" | "link" | null>(null);
  const [amount, setAmount] = useState(formatAmountInput(item.amountCents));
  const [date, setDate] = useState<string | null>(item.date <= lookups.today ? item.date : lookups.today);
  const [accountId, setAccountId] = useState<string | null>(item.accountId);

  const doneLabel = item.type === "income" ? "Eingegangen" : "Bezahlt";
  const isRecurring = item.source === "recurring";

  const settle = () => {
    if (!isRecurring) return run(() => setTransactionStatus(item.sourceId, "booked"));
    if (!item.accountId) {
      setDialog("details");
      return Promise.resolve(false);
    }
    return run(() => settleRecurring({ id: item.sourceId, due: item.date, mode: "book" }));
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="secondary" isPending={pending} onPress={settle} className="h-7 px-2.5 text-[12.5px]">
          {doneLabel}
        </Button>
        <Dropdown>
          <Button size="sm" variant="ghost" isIconOnly aria-label={`Weitere Aktionen für ${item.title}`} className="size-7 min-w-7">
            <DotsThreeVertical weight="bold" className="size-4" />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              onAction={(key) => {
                if (key === "details") setDialog("details");
                if (key === "skip") setDialog("skip");
                if (key === "link") setDialog("link");
                if (key === "edit") {
                  if (recurring) openRecurring(recurring);
                  else if (transaction) openTransaction(transaction.type, transaction);
                }
              }}
            >
              {isRecurring ? (
                <Dropdown.Item id="details" textValue="Mit Details buchen">
                  <Label>{doneLabel} mit anderem Betrag oder Datum …</Label>
                </Dropdown.Item>
              ) : null}
              {isRecurring ? (
                <Dropdown.Item id="link" textValue="Mit vorhandener Buchung verknüpfen">
                  <Label>Mit vorhandener Buchung verknüpfen …</Label>
                </Dropdown.Item>
              ) : null}
              {isRecurring ? (
                <Dropdown.Item id="skip" textValue="Termin überspringen">
                  <Label>Termin überspringen …</Label>
                </Dropdown.Item>
              ) : null}
              {recurring || transaction ? (
                <Dropdown.Item id="edit" textValue="Bearbeiten">
                  <Label>Bearbeiten …</Label>
                </Dropdown.Item>
              ) : null}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      {isRecurring && (
        <FormDialog
          isOpen={dialog === "details"}
          onOpenChange={(open) => setDialog(open ? "details" : null)}
          title={`${item.title}: ${doneLabel.toLowerCase()}`}
          description={`Termin vom ${formatDate(item.date)}`}
          submitLabel={`Als ${doneLabel.toLowerCase()} buchen`}
          pending={pending}
          onSubmit={() =>
            run(() => settleRecurring({ id: item.sourceId, due: item.date, mode: "book", amount, date, accountId }))
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyInput label="Betrag" value={amount} onChange={setAmount} />
            <DateInput label="Datum" value={date} onChange={setDate} isRequired />
          </div>
          <SelectInput
            label="Konto"
            value={accountId}
            onChange={setAccountId}
            options={lookups.accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, label: a.name }))}
            isRequired
          />
        </FormDialog>
      )}

      {isRecurring && dialog === "link" && <LinkDialog item={item} onClose={() => setDialog(null)} />}

      {isRecurring && (
        <ConfirmDialog
          isOpen={dialog === "skip"}
          onOpenChange={(open) => setDialog(open ? "skip" : null)}
          title="Termin überspringen?"
          confirmLabel="Überspringen"
          tone="default"
          pending={pending}
          onConfirm={() => run(() => settleRecurring({ id: item.sourceId, due: item.date, mode: "skip" }))}
        >
          <p>
            Der Termin vom {formatDate(item.date)} wird als erledigt markiert, ohne eine Buchung anzulegen. Sinnvoll, wenn die
            Zahlung bereits erfasst oder importiert wurde oder ausgefallen ist.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

/**
 * Termin mit einer vorhandenen Buchung verknuepfen, z. B. wenn die Zahlung
 * per Import kam und anders heisst oder einen anderen Betrag hat.
 */
function LinkDialog({ item, onClose }: { item: OpenItem; onClose: () => void }) {
  const { run, pending } = useAction();
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    findLinkCandidates(item.sourceId, item.date).then((list) => {
      if (cancelled) return;
      setCandidates(list);
      setSelected(list.find((candidate) => candidate.likely)?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [item.sourceId, item.date]);

  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`${item.title}: mit Buchung verknüpfen`}
      description={`Termin vom ${formatDate(item.date)} über ${formatMoney(item.amountCents)}. Die gewählte Buchung gilt dann als diese Zahlung – es entsteht keine neue Buchung.`}
      submitLabel="Verknüpfen"
      pending={pending}
      onSubmit={async () => (selected ? run(() => linkRecurringPayment({ recurringId: item.sourceId, due: item.date, transactionId: selected })) : false)}
    >
      {candidates === null ? (
        <p className="text-muted">Suche passende Buchungen …</p>
      ) : candidates.length === 0 ? (
        <p className="text-muted">Keine passende Buchung 20 Tage vor oder nach dem Termin gefunden.</p>
      ) : (
        <div role="radiogroup" aria-label="Buchung" className="max-h-72 overflow-auto rounded-[var(--radius)] border border-border">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              role="radio"
              aria-checked={selected === candidate.id}
              onClick={() => setSelected(candidate.id)}
              className={`flex w-full items-center justify-between gap-3 border-b border-separator px-3 py-2 text-left text-[13px] last:border-0 ${
                selected === candidate.id ? "bg-surface-secondary font-medium" : "hover:bg-surface-secondary/60"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className={`size-3 shrink-0 rounded-full border ${selected === candidate.id ? "border-accent bg-accent" : "border-border"}`} />
                <span className="w-14 shrink-0 text-muted">{formatDayShort(candidate.date)}</span>
                <span className="truncate">{candidate.title}</span>
                {candidate.likely && <span className="label shrink-0 font-normal text-success">passt</span>}
              </span>
              <span className="num shrink-0">{formatMoney(candidate.amountCents)}</span>
            </button>
          ))}
        </div>
      )}
    </FormDialog>
  );
}
