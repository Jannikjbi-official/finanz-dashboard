"use client";

import { Plus, X } from "@phosphor-icons/react";
import { Button } from "@heroui/react";
import { useState } from "react";
import { useAction } from "@/lib/client/use-action";
import type { Category, Transaction } from "@/lib/domain/types";
import { formatAmountInput, formatMoney } from "@/lib/format";
import { parseAmountToCents } from "@/lib/money";
import { splitTransaction } from "@/lib/server/actions/transactions";
import { MoneyInput, SelectInput, TextInput } from "./fields";
import { FormDialog } from "./form-dialog";

type Part = { key: number; amount: string; categoryId: string | null; title: string };

/**
 * Buchung in Teile mit eigener Kategorie aufteilen, z. B. einen
 * Drogerie-Einkauf in Lebensmittel und Haushalt. Die Summe muss stimmen.
 */
export function SplitDialog({
  isOpen,
  onOpenChange,
  transaction,
  categories,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  categories: Category[];
}) {
  const { run, pending } = useAction();
  const [parts, setParts] = useState<Part[]>([
    { key: 1, amount: formatAmountInput(transaction.amountCents), categoryId: transaction.categoryId, title: "" },
    { key: 2, amount: "", categoryId: null, title: "" },
  ]);
  const options = [{ id: "none", label: "Ohne Kategorie" }, ...categories.filter((c) => c.kind === transaction.type).map((c) => ({ id: c.id, label: c.name }))];
  const sum = parts.reduce((total, part) => total + (parseAmountToCents(part.amount) ?? 0), 0);
  const rest = transaction.amountCents - sum;

  const update = (key: number, patch: Partial<Part>) => setParts((current) => current.map((part) => (part.key === key ? { ...part, ...patch } : part)));
  const add = () =>
    setParts((current) => [...current, { key: Math.max(...current.map((part) => part.key)) + 1, amount: rest > 0 ? formatAmountInput(rest) : "", categoryId: null, title: "" }]);

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Buchung aufteilen"
      description={`${transaction.title} · ${formatMoney(transaction.amountCents)} – jeder Teil bekommt seine eigene Kategorie. Der Kontostand ändert sich nicht.`}
      submitLabel={`In ${parts.length} Teile aufteilen`}
      pending={pending}
      onSubmit={() =>
        run(() =>
          splitTransaction({
            id: transaction.id,
            parts: parts.map((part) => ({ amount: part.amount, categoryId: part.categoryId, title: part.title })),
          }),
        )
      }
      extraActions={
        <Button size="sm" variant="ghost" onPress={add} isDisabled={parts.length >= 20}>
          <Plus className="size-4" /> Teil
        </Button>
      }
    >
      <ol className="flex flex-col gap-4">
        {parts.map((part, index) => (
          <li key={part.key} className="flex flex-col gap-2 rounded-[var(--radius)] border border-separator p-3">
            <div className="flex items-center justify-between">
              <span className="label">Teil {index + 1}</span>
              {parts.length > 2 && (
                <Button size="sm" variant="ghost" isIconOnly aria-label={`Teil ${index + 1} entfernen`} onPress={() => setParts((current) => current.filter((p) => p.key !== part.key))}>
                  <X className="size-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MoneyInput label="Betrag" value={part.amount} onChange={(amount) => update(part.key, { amount })} />
              <SelectInput label="Kategorie" value={part.categoryId} onChange={(categoryId) => update(part.key, { categoryId })} placeholder="Ohne Kategorie" options={options} />
            </div>
            <TextInput
              label="Beschreibung (optional)"
              value={part.title}
              onChange={(title) => update(part.key, { title })}
              placeholder={index === 0 ? transaction.title : "z. B. Putzmittel"}
              maxLength={120}
            />
          </li>
        ))}
      </ol>
      <p className={`text-[13px] ${rest === 0 ? "text-success" : "text-warning"}`} role="status">
        {rest === 0 ? "Summe stimmt." : rest > 0 ? `Noch ${formatMoney(rest)} zu verteilen.` : `${formatMoney(-rest)} zu viel verteilt.`}
      </p>
    </FormDialog>
  );
}
