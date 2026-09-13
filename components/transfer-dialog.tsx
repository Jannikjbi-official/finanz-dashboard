"use client";

import { useActionState, useEffect } from "react";
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
  addToast,
  useDisclosure,
} from "@heroui/react";
import { transferBetweenAccounts, type ActionState } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import type { Account } from "@/lib/types";

const INITIAL: ActionState = { ok: true };

export function TransferDialog({ accounts }: { accounts: Account[] }) {
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const [state, formAction, pending] = useActionState(
    transferBetweenAccounts,
    INITIAL,
  );

  useEffect(() => {
    if (state.ok && state.message) {
      addToast({ title: state.message, color: "success" });
      onClose();
    }
  }, [state, onClose]);

  return (
    <>
      <Button variant="flat" onPress={onOpen} isDisabled={accounts.length < 2}>
        Umbuchen
      </Button>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {() => (
            <form action={formAction}>
              <ModalHeader className="flex-col items-start gap-1">
                Zwischen Konten umbuchen
              </ModalHeader>

              <ModalBody className="gap-4">
                {state.error ? (
                  <Alert color="danger" variant="flat" title={state.error} />
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    isRequired
                    name="from"
                    label="Von"
                    variant="bordered"
                    defaultSelectedKeys={[accounts[0]?.id]}
                  >
                    {accounts.map((account) => (
                      <SelectItem key={account.id} textValue={account.name}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    isRequired
                    name="to"
                    label="Nach"
                    variant="bordered"
                    defaultSelectedKeys={[accounts[1]?.id]}
                  >
                    {accounts.map((account) => (
                      <SelectItem key={account.id} textValue={account.name}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </Select>

                  <Input
                    isRequired
                    name="amount"
                    label="Betrag"
                    variant="bordered"
                    inputMode="decimal"
                    endContent={<span className="text-small text-default-400">€</span>}
                  />

                  <Input
                    isRequired
                    name="date"
                    type="date"
                    label="Datum"
                    variant="bordered"
                    defaultValue={todayISO()}
                  />
                </div>

                <p className="text-tiny text-default-400">
                  Legt zwei Buchungen an: eine Ausgabe auf dem Quellkonto und eine
                  Einnahme auf dem Zielkonto. Der Monatssaldo bleibt dadurch
                  ausgeglichen.
                </p>
              </ModalBody>

              <ModalFooter>
                <Button variant="light" type="button" onPress={onClose}>
                  Abbrechen
                </Button>
                <Button color="primary" type="submit" isLoading={pending}>
                  Umbuchen
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
