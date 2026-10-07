"use client";

import { useState } from "react";
import { deleteTransaction, saveTransaction } from "@/lib/actions";
import { ActionForm, FormError } from "@/ui/action-form";
import { Button } from "@/ui/button";
import { AmountInput, Field, Input, Segmented, Select, Textarea } from "@/ui/field";
import { Confirm, Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { centsToInput, type AccountOption, type CategoryOption, type TransactionRow } from "./types";

type Precision = "day" | "range" | "month";

/**
 * Buchung erfassen oder bearbeiten. Das Datum darf unscharf sein: genauer
 * Tag, Zeitraum oder ganzer Monat - wer es nicht genau weiss, muss nicht raten.
 */
export function TransactionSheet({
  open,
  onOpenChange,
  categories,
  accounts,
  transaction,
  today,
  defaultAccountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryOption[];
  accounts: AccountOption[];
  transaction?: TransactionRow | null;
  today: string;
  defaultAccountId?: string | null;
}) {
  const editing = Boolean(transaction);
  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? "expense");
  const [precision, setPrecision] = useState<Precision>(transaction?.datePrecision ?? "day");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const formId = editing ? `tx-${transaction!.id}` : "tx-new";

  const visibleCategories = categories.filter((category) => category.kind === type);
  const activeAccounts = accounts.filter((account) => !account.archived || account.id === transaction?.accountId);
  const isTransfer = Boolean(transaction?.transferGroupId);

  async function remove() {
    const data = new FormData();
    data.set("id", transaction!.id);
    const result = await deleteTransaction({ ok: false }, data);
    setConfirmDelete(false);
    if (result.ok) {
      toast(result.message ?? "Gelöscht");
      onOpenChange(false);
    } else {
      toast(result.error ?? "Löschen fehlgeschlagen", "error");
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={editing ? "Buchung bearbeiten" : "Buchung erfassen"}
        description={isTransfer ? "Teil einer Umbuchung zwischen deinen Konten." : undefined}
        footer={
          <div className="flex items-center justify-between gap-2">
            {editing ? (
              <Button variant="ghost" className="text-neg" onClick={() => setConfirmDelete(true)}>
                Löschen
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button variant="primary" type="submit" form={formId}>
                Speichern
              </Button>
            </div>
          </div>
        }
      >
        <ActionForm id={formId} action={saveTransaction} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
          {({ error }) => (
            <>
              {transaction ? <input type="hidden" name="id" value={transaction.id} /> : null}
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="datePrecision" value={precision} />

              <Segmented
                name="type-switch"
                value={type}
                onChange={setType}
                className="w-full"
                options={[
                  { value: "expense", label: "Ausgabe" },
                  { value: "income", label: "Einnahme" },
                ]}
              />

              <div className="grid grid-cols-[1fr_9rem] gap-3">
                <Field label="Bezeichnung" htmlFor="tx-title">
                  <Input id="tx-title" name="title" required maxLength={80} defaultValue={transaction?.title} placeholder={type === "expense" ? "z. B. Wocheneinkauf" : "z. B. Gehalt"} autoFocus={!editing} />
                </Field>
                <Field label="Betrag" htmlFor="tx-amount">
                  <AmountInput id="tx-amount" name="amount" required defaultValue={centsToInput(transaction?.amountCents)} />
                </Field>
              </div>

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Wann</legend>
                <Segmented
                  name="precision-switch"
                  size="sm"
                  value={precision}
                  onChange={setPrecision}
                  options={[
                    { value: "day", label: "Genauer Tag" },
                    { value: "range", label: "Zeitraum" },
                    { value: "month", label: "Ganzer Monat" },
                  ]}
                />
                {precision === "month" ? (
                  <Input type="month" name="month" aria-label="Monat" defaultValue={(transaction?.date ?? today).slice(0, 7)} required />
                ) : (
                  <div className={precision === "range" ? "grid grid-cols-2 gap-3" : ""}>
                    <Input type="date" name="date" aria-label={precision === "range" ? "Von" : "Datum"} defaultValue={transaction?.date ?? today} required />
                    {precision === "range" ? (
                      <Input type="date" name="dateEnd" aria-label="Bis" defaultValue={transaction?.dateEnd ?? transaction?.date ?? today} required />
                    ) : null}
                  </div>
                )}
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Kategorie" htmlFor="tx-category">
                  <Select id="tx-category" name="categoryId" defaultValue={transaction?.categoryId ?? "none"} key={type}>
                    <option value="none">Ohne Kategorie</option>
                    {visibleCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Konto" htmlFor="tx-account">
                  <Select id="tx-account" name="accountId" defaultValue={transaction?.accountId ?? defaultAccountId ?? activeAccounts[0]?.id ?? "none"}>
                    <option value="none">Kein Konto</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Notiz" htmlFor="tx-note" optional>
                <Textarea id="tx-note" name="note" maxLength={300} defaultValue={transaction?.note ?? ""} rows={2} />
              </Field>

              <FormError error={error} />
            </>
          )}
        </ActionForm>
      </Sheet>

      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Buchung löschen?"
        description={
          isTransfer
            ? "Beide Hälften der Umbuchung werden endgültig entfernt."
            : `„${transaction?.title}“ wird endgültig entfernt.`
        }
      >
        <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
          Abbrechen
        </Button>
        <Button variant="danger" onClick={remove}>
          Löschen
        </Button>
      </Confirm>
    </>
  );
}
