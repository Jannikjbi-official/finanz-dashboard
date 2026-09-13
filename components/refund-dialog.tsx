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
import { saveRefund, type ActionState } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import type { Account, Category, Refund } from "@/lib/types";

const INITIAL: ActionState = { ok: true };

type Timing = "unknown" | "day" | "range";

function initialTiming(refund?: Refund): Timing {
  if (!refund?.expectedFrom) return "unknown";
  return refund.expectedTo && refund.expectedTo !== refund.expectedFrom
    ? "range"
    : "day";
}

export function RefundDialog({
  categories,
  accounts,
  refund,
  isOpen: controlledOpen,
  onOpenChange: controlledOpenChange,
}: {
  categories: Category[];
  accounts: Account[];
  refund?: Refund;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const internal = useDisclosure();
  const controlled = controlledOpen !== undefined;

  const isOpen = controlled ? controlledOpen : internal.isOpen;
  const onOpenChange = controlled
    ? (open: boolean) => controlledOpenChange?.(open)
    : internal.onOpenChange;
  const onClose = controlled
    ? () => controlledOpenChange?.(false)
    : internal.onClose;

  const [state, formAction, pending] = useActionState(saveRefund, INITIAL);
  const [timing, setTiming] = useState<Timing>(initialTiming(refund));

  useEffect(() => {
    if (state.ok && state.message) {
      addToast({ title: state.message, color: "success" });
      onClose();
    }
  }, [state, onClose]);

  const incomeCategories = categories.filter(
    (category) => category.kind === "income",
  );

  return (
    <>
      {controlled ? null : (
        <Button color="primary" onPress={internal.onOpen}>
          Erstattung eintragen
        </Button>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" size="lg">
        <ModalContent>
          {() => (
            <form action={formAction}>
              <ModalHeader className="flex-col items-start gap-1">
                {refund ? "Erstattung bearbeiten" : "Erwartete Erstattung"}
              </ModalHeader>

              <ModalBody className="gap-4">
                {refund ? (
                  <input type="hidden" name="id" value={refund.id} />
                ) : null}

                {state.error ? (
                  <Alert color="danger" variant="flat" title={state.error} />
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    isRequired
                    name="title"
                    label="Wofür"
                    variant="bordered"
                    placeholder="z.B. Krankenkasse Brille"
                    defaultValue={refund?.title}
                  />

                  <Input
                    isRequired
                    name="amount"
                    label="Erwarteter Betrag"
                    variant="bordered"
                    inputMode="decimal"
                    defaultValue={
                      refund ? (refund.amountCents / 100).toFixed(2) : ""
                    }
                    endContent={<span className="text-small text-default-400">€</span>}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <Tabs
                    aria-label="Wann kommt das Geld?"
                    fullWidth
                    size="sm"
                    selectedKey={timing}
                    onSelectionChange={(key) => setTiming(key as Timing)}
                  >
                    <Tab key="unknown" title="Unbekannt" />
                    <Tab key="day" title="Bestimmter Tag" />
                    <Tab key="range" title="Zeitraum" />
                  </Tabs>

                  {timing === "unknown" ? (
                    <p className="text-tiny text-default-400">
                      Kein Datum nötig. Die Erstattung bleibt offen, bis du sie
                      als erhalten markierst.
                    </p>
                  ) : timing === "day" ? (
                    <Input
                      name="expectedFrom"
                      type="date"
                      label="Erwartet am"
                      variant="bordered"
                      defaultValue={refund?.expectedFrom ?? todayISO()}
                    />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        name="expectedFrom"
                        type="date"
                        label="Frühestens"
                        variant="bordered"
                        defaultValue={refund?.expectedFrom ?? todayISO()}
                      />
                      <Input
                        name="expectedTo"
                        type="date"
                        label="Spätestens"
                        variant="bordered"
                        defaultValue={
                          refund?.expectedTo ?? refund?.expectedFrom ?? todayISO()
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    name="categoryId"
                    label="Kategorie beim Eingang"
                    variant="bordered"
                    defaultSelectedKeys={
                      refund?.categoryId ? [refund.categoryId] : ["none"]
                    }
                  >
                    {[
                      { id: "none", name: "Ohne Kategorie", icon: "" },
                      ...incomeCategories,
                    ].map((category) => (
                      <SelectItem key={category.id} textValue={category.name}>
                        {category.icon ? `${category.icon} ` : ""}
                        {category.name}
                      </SelectItem>
                    ))}
                  </Select>

                  {accounts.length > 0 ? (
                    <Select
                      name="accountId"
                      label="Konto beim Eingang"
                      variant="bordered"
                      defaultSelectedKeys={
                        refund?.accountId ? [refund.accountId] : ["none"]
                      }
                    >
                      {[{ id: "none", name: "Ohne Konto" }, ...accounts].map(
                        (account) => (
                          <SelectItem key={account.id} textValue={account.name}>
                            {account.name}
                          </SelectItem>
                        ),
                      )}
                    </Select>
                  ) : null}
                </div>

                <Textarea
                  name="note"
                  label="Notiz"
                  variant="bordered"
                  minRows={2}
                  placeholder="z.B. Antrag am 12.09. eingereicht"
                  defaultValue={refund?.note ?? ""}
                />
              </ModalBody>

              <ModalFooter>
                <Button variant="light" type="button" onPress={onClose}>
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
