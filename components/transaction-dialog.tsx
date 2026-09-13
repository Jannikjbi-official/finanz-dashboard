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
import { saveTransaction, type ActionState } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import type { Category, Kind, Transaction } from "@/lib/types";

const INITIAL: ActionState = { ok: true };

export function TransactionDialog({
  categories,
  transaction,
  trigger,
  defaultType = "expense",
}: {
  categories: Category[];
  transaction?: Transaction;
  trigger?: React.ReactNode;
  defaultType?: Kind;
}) {
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const [state, formAction, pending] = useActionState(saveTransaction, INITIAL);
  const [type, setType] = useState<Kind>(transaction?.type ?? defaultType);

  useEffect(() => {
    if (state.ok && state.message) {
      addToast({ title: state.message, color: "success" });
      onClose();
    }
  }, [state, onClose]);

  const options = categories.filter((category) => category.kind === type);

  return (
    <>
      {trigger ? (
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
            <form action={formAction}>
              <ModalHeader className="flex-col items-start gap-1">
                {transaction ? "Buchung bearbeiten" : "Neue Buchung"}
              </ModalHeader>

              <ModalBody className="gap-4">
                {transaction ? (
                  <input type="hidden" name="id" value={transaction.id} />
                ) : null}
                <input type="hidden" name="type" value={type} />

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
                    placeholder="z.B. Wocheneinkauf"
                  />

                  <Input
                    isRequired
                    name="amount"
                    label="Betrag"
                    variant="bordered"
                    inputMode="decimal"
                    defaultValue={
                      transaction ? (transaction.amountCents / 100).toFixed(2) : ""
                    }
                    endContent={
                      <span className="text-small text-default-400">&euro;</span>
                    }
                  />

                  <Input
                    isRequired
                    name="date"
                    type="date"
                    label="Datum"
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
                    {[
                      { id: "none", name: "Ohne Kategorie", icon: "" },
                      ...options,
                    ].map((category) => (
                      <SelectItem key={category.id} textValue={category.name}>
                        {category.icon ? `${category.icon} ` : ""}
                        {category.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                <Textarea
                  name="note"
                  label="Notiz"
                  variant="bordered"
                  minRows={2}
                  defaultValue={transaction?.note ?? ""}
                />
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
