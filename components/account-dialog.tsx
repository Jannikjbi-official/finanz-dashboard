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
  addToast,
  useDisclosure,
} from "@heroui/react";
import { saveAccount, type ActionState } from "@/lib/actions";
import { ACCOUNT_KIND_LABEL, type Account } from "@/lib/types";

const INITIAL: ActionState = { ok: true };
const KINDS = ["giro", "cash", "savings", "other"] as const;
const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#0ea5e9", "#ec4899", "#64748b"];

export function AccountDialog({
  account,
  isOpen: controlledOpen,
  onOpenChange: controlledOpenChange,
}: {
  account?: Account;
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

  const [state, formAction, pending] = useActionState(saveAccount, INITIAL);
  const [color, setColor] = useState(account?.color ?? COLORS[0]);

  useEffect(() => {
    if (state.ok && state.message) {
      addToast({ title: state.message, color: "success" });
      onClose();
    }
  }, [state, onClose]);

  return (
    <>
      {controlled ? null : (
        <Button color="primary" onPress={internal.onOpen}>
          Konto anlegen
        </Button>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {() => (
            <form action={formAction}>
              <ModalHeader>
                {account ? "Konto bearbeiten" : "Neues Konto"}
              </ModalHeader>

              <ModalBody className="gap-4">
                {account ? (
                  <input type="hidden" name="id" value={account.id} />
                ) : null}
                <input type="hidden" name="color" value={color} />

                {state.error ? (
                  <Alert color="danger" variant="flat" title={state.error} />
                ) : null}

                <div className="flex gap-2">
                  <Input
                    name="icon"
                    aria-label="Symbol"
                    className="w-20"
                    variant="bordered"
                    placeholder="🏦"
                    defaultValue={account?.icon ?? ""}
                  />
                  <Input
                    isRequired
                    name="name"
                    label="Name"
                    variant="bordered"
                    placeholder="z.B. Sparkasse Giro"
                    defaultValue={account?.name}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    isRequired
                    name="kind"
                    label="Art"
                    variant="bordered"
                    defaultSelectedKeys={[account?.kind ?? "giro"]}
                  >
                    {KINDS.map((kind) => (
                      <SelectItem key={kind} textValue={ACCOUNT_KIND_LABEL[kind]}>
                        {ACCOUNT_KIND_LABEL[kind]}
                      </SelectItem>
                    ))}
                  </Select>

                  <Input
                    name="startBalance"
                    label="Startsaldo"
                    variant="bordered"
                    inputMode="decimal"
                    description="Kontostand, bevor du hier Buchungen erfasst"
                    defaultValue={
                      account ? (account.startBalanceCents / 100).toFixed(2) : ""
                    }
                    endContent={<span className="text-small text-default-400">€</span>}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-label={`Farbe ${preset}`}
                      onClick={() => setColor(preset)}
                      className={`h-7 w-7 rounded-full transition-transform ${
                        color === preset ? "scale-110 ring-2 ring-foreground/60" : ""
                      }`}
                      style={{ background: preset }}
                    />
                  ))}
                </div>
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
