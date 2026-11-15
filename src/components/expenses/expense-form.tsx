"use client";

import {
  Button,
  Description,
  Form,
  Input,
  Label,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast,
} from "@heroui/react";
import { Banknote, CreditCard, Landmark, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CategoryPicker, type CategoryOption, DateInput, IntervalSelect, MoneyField } from "@/components/forms/fields";
import { enqueue, isNetworkError } from "@/lib/client/offline-queue";
import { todayIso } from "@/lib/dates";
import { type IntervalId, PAYMENT_METHODS, type PaymentMethodId } from "@/lib/finance";
import { eurosToCents, formatCents } from "@/lib/money";
import { createExpense, updateExpense } from "@/server/actions";

const PAYMENT_ICONS: Record<PaymentMethodId, typeof Wallet> = {
  bar: Banknote,
  karte: CreditCard,
  paypal: Wallet,
  ueberweisung: Landmark,
};

export interface ExpenseFormValues {
  id?: string;
  amountCents: number | null;
  categoryId: string | null;
  date: string;
  paymentMethod: PaymentMethodId;
  note: string;
}

export function ExpenseForm({
  categories,
  initial,
  onDone,
  autoFocus = true,
}: {
  categories: CategoryOption[];
  initial?: Partial<ExpenseFormValues>;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [amount, setAmount] = useState<number | null>(initial?.amountCents ? initial.amountCents / 100 : null);
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [date, setDate] = useState<string | null>(initial?.date ?? todayIso());
  const [payment, setPayment] = useState<PaymentMethodId>(initial?.paymentMethod ?? "karte");
  const [note, setNote] = useState(initial?.note ?? "");
  const [recurring, setRecurring] = useState(false);
  const [interval, setInterval] = useState<IntervalId | null>("monatlich");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      clientId: crypto.randomUUID(),
      amountCents: amount ? eurosToCents(amount) : 0,
      categoryId,
      date: date ?? "",
      paymentMethod: payment,
      note,
      recurring,
      interval: recurring ? interval : null,
    };
    startTransition(async () => {
      try {
        const res = isEdit ? await updateExpense({ ...payload, id: initial!.id }) : await createExpense(payload);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          toast.danger(res.error);
          return;
        }
        setErrors({});
        const cat = categories.find((c) => c.id === categoryId);
        toast.success(isEdit ? "Ausgabe aktualisiert" : "Ausgabe gespeichert", {
          description: `${formatCents(payload.amountCents)}${cat ? ` · ${cat.name}` : ""}`,
        });
        router.refresh();
        onDone?.();
      } catch (error) {
        if (!isEdit && isNetworkError(error)) {
          enqueue({ type: "expense", payload });
          toast.warning("Offline gespeichert", {
            description: "Die Ausgabe wird automatisch synchronisiert, sobald du wieder online bist.",
          });
          onDone?.();
          return;
        }
        toast.danger("Speichern fehlgeschlagen");
      }
    });
  }

  return (
    <Form
      onSubmit={submit}
      validationErrors={errors}
      validationBehavior="aria"
      className="flex flex-col gap-5"
      aria-label={isEdit ? "Ausgabe bearbeiten" : "Neue Ausgabe"}
    >
      <MoneyField
        label="Betrag"
        name="amountCents"
        value={amount}
        onChange={setAmount}
        autoFocus={autoFocus}
        isRequired
        size="lg"
      />

      <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />

      <div className="grid gap-5 sm:grid-cols-2">
        <DateInput label="Datum" name="date" value={date} onChange={setDate} isRequired />
        <TextField name="note" value={note} onChange={setNote} maxLength={500}>
          <Label>Notiz</Label>
          <Input placeholder="z. B. Wocheneinkauf" />
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <Label id="payment-label">Zahlungsart</Label>
        <ToggleButtonGroup
          aria-labelledby="payment-label"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([payment])}
          onSelectionChange={(keys) => {
            const k = [...keys][0];
            if (k) setPayment(k as PaymentMethodId);
          }}
          fullWidth
          className="flex-wrap sm:flex-nowrap"
        >
          {PAYMENT_METHODS.map((m, i) => {
            const Icon = PAYMENT_ICONS[m.id];
            return (
              <ToggleButton key={m.id} id={m.id} className="min-h-11 flex-1">
                {i > 0 && <ToggleButtonGroup.Separator />}
                <Icon className="size-4" aria-hidden="true" />
                {m.label}
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>
      </div>

      {!isEdit && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-4">
          <Switch isSelected={recurring} onChange={setRecurring} name="recurring">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label>Wiederkehrend</Label>
              <Description>Wird automatisch im gewählten Rhythmus gebucht.</Description>
            </Switch.Content>
          </Switch>
          {recurring && <IntervalSelect value={interval} onChange={setInterval} isRequired />}
        </div>
      )}

      <Button type="submit" size="lg" fullWidth isPending={pending} className="h-12 rounded-2xl">
        {isEdit ? "Änderungen speichern" : "Ausgabe speichern"}
      </Button>
    </Form>
  );
}
