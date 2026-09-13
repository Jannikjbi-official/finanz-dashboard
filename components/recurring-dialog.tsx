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
  Switch,
  Tab,
  Tabs,
  Textarea,
  addToast,
  useDisclosure,
} from "@heroui/react";
import { saveRecurring, type ActionState } from "@/lib/actions";
import { INTERVAL_LABEL, todayISO } from "@/lib/dates";
import type { Category, Interval, Kind, Recurring } from "@/lib/types";

const INITIAL: ActionState = { ok: true };
const INTERVALS: Interval[] = ["monthly", "yearly", "quarterly", "weekly"];

export function RecurringDialog({
  categories,
  entry,
  trigger,
  lockType,
}: {
  categories: Category[];
  entry?: Recurring;
  trigger?: React.ReactNode;
  /** Typ festnageln - auf der Abo-Seite gibt es nur Ausgaben. */
  lockType?: Kind;
}) {
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const [state, formAction, pending] = useActionState(saveRecurring, INITIAL);
  const [type, setType] = useState<Kind>(entry?.type ?? lockType ?? "expense");
  const [active, setActive] = useState(entry?.active ?? true);

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
          Abo hinzufügen
        </Button>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" size="lg">
        <ModalContent>
          {() => (
            <form action={formAction}>
              <ModalHeader className="flex-col items-start gap-1">
                {entry
                  ? "Abo bearbeiten"
                  : lockType === "expense"
                    ? "Neues Abo"
                    : "Neues Abo / Dauerauftrag"}
              </ModalHeader>

              <ModalBody className="gap-4">
                {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="active" value={String(active)} />

                {lockType && (!entry || entry.type === lockType) ? null : (
                  <Tabs
                    aria-label="Typ"
                    fullWidth
                    selectedKey={type}
                    onSelectionChange={(key) => setType(key as Kind)}
                    color={type === "income" ? "success" : "danger"}
                  >
                    <Tab key="expense" title="Feste Ausgabe" />
                    <Tab key="income" title="Feste Einnahme" />
                  </Tabs>
                )}

                {state.error ? (
                  <Alert color="danger" variant="flat" title={state.error} />
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    isRequired
                    name="title"
                    label="Bezeichnung"
                    variant="bordered"
                    placeholder="z.B. Spotify"
                    defaultValue={entry?.title}
                  />

                  <Input
                    isRequired
                    name="amount"
                    label="Betrag pro Zahlung"
                    variant="bordered"
                    inputMode="decimal"
                    defaultValue={entry ? (entry.amountCents / 100).toFixed(2) : ""}
                    endContent={
                      <span className="text-small text-default-400">&euro;</span>
                    }
                  />

                  <Select
                    isRequired
                    name="interval"
                    label="Intervall"
                    variant="bordered"
                    defaultSelectedKeys={[entry?.interval ?? "monthly"]}
                  >
                    {INTERVALS.map((value) => (
                      <SelectItem key={value} textValue={INTERVAL_LABEL[value]}>
                        {INTERVAL_LABEL[value]}
                      </SelectItem>
                    ))}
                  </Select>

                  <Input
                    isRequired
                    name="startDate"
                    type="date"
                    label="Erste Zahlung"
                    variant="bordered"
                    defaultValue={entry?.startDate ?? todayISO()}
                  />

                  <Select
                    name="categoryId"
                    label="Kategorie"
                    variant="bordered"
                    className="sm:col-span-2"
                    defaultSelectedKeys={
                      entry?.categoryId ? [entry.categoryId] : ["none"]
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
                  defaultValue={entry?.note ?? ""}
                />

                <Switch isSelected={active} onValueChange={setActive} size="sm">
                  Aktiv
                </Switch>
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
