"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Tab,
  Tabs,
  Textarea,
  addToast,
  useDisclosure,
} from "@heroui/react";
import { saveRecurring, saveTransaction, type ActionState } from "@/lib/actions";
import { INTERVAL_LABEL, todayISO } from "@/lib/dates";
import type { Category, Interval, Kind, Transaction } from "@/lib/types";
import type { Account } from "@/lib/types";

const INITIAL: ActionState = { ok: true };
const INTERVALS: Interval[] = ["monthly", "yearly", "quarterly", "weekly"];

type Mode = "once" | "recurring";

export function TransactionDialog({
  categories,
  accounts = [],
  transaction,
  trigger,
  defaultType = "expense",
  isOpen: controlledOpen,
  onOpenChange: controlledOpenChange,
}: {
  categories: Category[];
  accounts?: Account[];
  transaction?: Transaction;
  trigger?: React.ReactNode;
  defaultType?: Kind;
  /** Von aussen gesteuert, z.B. aus einem Aktionsmenue heraus. */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const internal = useDisclosure();
  const controlled = controlledOpen !== undefined;

  const isOpen = controlled ? controlledOpen : internal.isOpen;
  const onOpen = controlled ? () => controlledOpenChange?.(true) : internal.onOpen;
  const onOpenChange = controlled
    ? (open: boolean) => controlledOpenChange?.(open)
    : internal.onOpenChange;
  const onClose = controlled
    ? () => controlledOpenChange?.(false)
    : internal.onClose;

  const [mode, setMode] = useState<Mode>("once");
  const [type, setType] = useState<Kind>(transaction?.type ?? defaultType);

  const [txState, txAction, txPending] = useActionState(saveTransaction, INITIAL);
  const [recState, recAction, recPending] = useActionState(saveRecurring, INITIAL);

  const state = mode === "once" ? txState : recState;
  const pending = mode === "once" ? txPending : recPending;

  useEffect(() => {
    if (state.ok && state.message) {
      addToast({ title: state.message, color: "success" });
      onClose();
    }
  }, [state, onClose]);

  const options = categories.filter((category) => category.kind === type);
  const categoryOptions = [
    { id: "none", name: "Ohne Kategorie", icon: "" },
    ...options,
  ];

  return (
    <>
      {controlled ? null : trigger ? (
        <span onClick={onOpen} role="button" tabIndex={-1}>
          {trigger}
        </span>
      ) : (
        <Button color="primary" onPress={onOpen}>
          Buchung hinzufügen
        </Button>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" size="lg">
        <ModalContent>
          {() => (
            <form action={mode === "once" ? txAction : recAction} key={mode}>
              <ModalHeader className="flex-col items-start gap-1">
                {transaction
                  ? "Buchung bearbeiten"
                  : mode === "once"
                    ? "Neue Buchung"
                    : "Neuer Dauerauftrag"}
              </ModalHeader>

              <ModalBody className="gap-4">
                {transaction ? (
                  <input type="hidden" name="id" value={transaction.id} />
                ) : null}
                <input type="hidden" name="type" value={type} />
                {mode === "recurring" ? (
                  <input type="hidden" name="active" value="true" />
                ) : null}

                {/* Beim Bearbeiten bleibt es eine Buchung - kein Moduswechsel. */}
                {transaction ? null : (
                  <Tabs
                    aria-label="Art"
                    fullWidth
                    size="sm"
                    selectedKey={mode}
                    onSelectionChange={(key) => setMode(key as Mode)}
                  >
                    <Tab key="once" title="Einmalig" />
                    <Tab key="recurring" title="Dauerauftrag" />
                  </Tabs>
                )}

                <Tabs
                  aria-label="Typ"
                  fullWidth
                  selectedKey={type}
                  onSelectionChange={(key) => setType(key as Kind)}
                  color={type === "income" ? "success" : "danger"}
                >
                  <Tab key="expense" title="Ausgabe" />
                  <Tab key="income" title="Einnahme" />
                </Tabs>

                {state.error ? (
                  <Alert color="danger" variant="flat" title={state.error} />
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    isRequired
                    name="title"
                    label="Bezeichnung"
                    variant="bordered"
                    defaultValue={transaction?.title}
                    placeholder={
                      mode === "once" ? "z.B. Wocheneinkauf" : "z.B. Spotify"
                    }
                  />

                  <Input
                    isRequired
                    name="amount"
                    label={mode === "once" ? "Betrag" : "Betrag pro Zahlung"}
                    variant="bordered"
                    inputMode="decimal"
                    defaultValue={
                      transaction ? (transaction.amountCents / 100).toFixed(2) : ""
                    }
                    endContent={
                      <span className="text-small text-default-400">&euro;</span>
                    }
                  />

                  {mode === "recurring" ? (
                    <Select
                      isRequired
                      name="interval"
                      label="Intervall"
                      variant="bordered"
                      defaultSelectedKeys={["monthly"]}
                    >
                      {INTERVALS.map((value) => (
                        <SelectItem key={value} textValue={INTERVAL_LABEL[value]}>
                          {INTERVAL_LABEL[value]}
                        </SelectItem>
                      ))}
                    </Select>
                  ) : null}

                  <Input
                    isRequired
                    name={mode === "once" ? "date" : "startDate"}
                    type="date"
                    label={mode === "once" ? "Datum" : "Erste Zahlung"}
                    variant="bordered"
                    defaultValue={transaction?.date ?? todayISO()}
                  />

                  <Select
                    name="categoryId"
                    label="Kategorie"
                    variant="bordered"
                    defaultSelectedKeys={
                      transaction?.categoryId ? [transaction.categoryId] : ["none"]
                    }
                  >
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.id} textValue={category.name}>
                        {category.icon ? `${category.icon} ` : ""}
                        {category.name}
                      </SelectItem>
                    ))}
                  </Select>

                  {mode === "once" && accounts.length > 0 ? (
                    <Select
                      name="accountId"
                      label="Konto"
                      variant="bordered"
                      className="sm:col-span-2"
                      defaultSelectedKeys={
                        transaction?.accountId ? [transaction.accountId] : ["none"]
                      }
                    >
                      {[
                        { id: "none", name: "Ohne Konto", icon: "" },
                        ...accounts,
                      ].map((account) => (
                        <SelectItem key={account.id} textValue={account.name}>
                          {account.icon ? `${account.icon} ` : ""}
                          {account.name}
                        </SelectItem>
                      ))}
                    </Select>
                  ) : null}
                </div>

                <Textarea
                  name="note"
                  label="Notiz"
                  variant="bordered"
                  minRows={2}
                  defaultValue={transaction?.note ?? ""}
                />

                {mode === "recurring" ? (
                  <p className="text-tiny text-default-400">
                    Daueraufträge landen unter „Abos“ und werden dort auf Monats-
                    und Jahreskosten hochgerechnet. Eine fällige Zahlung übernimmst
                    du per Klick als echte Buchung.
                  </p>
                ) : null}
              </ModalBody>

              <ModalFooter>
                <Button variant="light" onPress={onClose} type="button">
                  Abbrechen
                </Button>
                <Button color="primary" type="submit" isLoading={pending}>
                  Speichern
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
