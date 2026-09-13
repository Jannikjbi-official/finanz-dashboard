"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  addToast,
  useDisclosure,
} from "@heroui/react";
import {
  adjustGoal,
  deleteGoal,
  saveGoal,
  type ActionState,
} from "@/lib/actions";
import { daysUntil } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/money";
import { Bar } from "@/components/ui";
import type { Goal } from "@/lib/types";

const INITIAL: ActionState = { ok: true };

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#0ea5e9", "#a855f7"];

/** Dialog zum Anlegen und Bearbeiten eines Sparziels. */
export function GoalDialog({
  goal,
  isOpen: controlledOpen,
  onOpenChange: controlledOpenChange,
}: {
  goal?: Goal;
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

  const [state, formAction, pending] = useActionState(saveGoal, INITIAL);
  const [color, setColor] = useState(goal?.color ?? COLORS[0]);

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
          Sparziel anlegen
        </Button>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {() => (
            <form action={formAction}>
              <ModalHeader>
                {goal ? "Sparziel bearbeiten" : "Neues Sparziel"}
              </ModalHeader>

              <ModalBody className="gap-4">
                {goal ? <input type="hidden" name="id" value={goal.id} /> : null}
                <input type="hidden" name="color" value={color} />

                {state.error ? (
                  <Alert color="danger" variant="flat" title={state.error} />
                ) : null}

                <Input
                  isRequired
                  name="title"
                  label="Wofür sparst du?"
                  variant="bordered"
                  placeholder="z.B. Urlaub"
                  defaultValue={goal?.title}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    isRequired
                    name="target"
                    label="Zielbetrag"
                    variant="bordered"
                    inputMode="decimal"
                    defaultValue={
                      goal ? (goal.targetCents / 100).toFixed(2) : ""
                    }
                    endContent={<span className="text-small text-default-400">€</span>}
                  />

                  {goal ? null : (
                    <Input
                      name="saved"
                      label="Schon gespart"
                      variant="bordered"
                      inputMode="decimal"
                      endContent={
                        <span className="text-small text-default-400">€</span>
                      }
                    />
                  )}

                  <Input
                    name="deadline"
                    type="date"
                    label="Zieldatum (optional)"
                    variant="bordered"
                    defaultValue={goal?.deadline ?? ""}
                  />
                </div>

                <Textarea
                  name="note"
                  label="Notiz"
                  variant="bordered"
                  minRows={2}
                  defaultValue={goal?.note ?? ""}
                />

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

export function GoalCard({ goal }: { goal: Goal }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();

  const share = goal.targetCents > 0 ? (goal.savedCents / goal.targetCents) * 100 : 0;
  const done = goal.savedCents >= goal.targetCents;
  const missing = Math.max(0, goal.targetCents - goal.savedCents);
  const days = goal.deadline ? daysUntil(goal.deadline) : null;

  function adjust(direction: "deposit" | "withdraw") {
    if (!amount.trim()) return;

    const formData = new FormData();
    formData.set("id", goal.id);
    formData.set("amount", amount);
    formData.set("direction", direction);

    startTransition(async () => {
      const result = await adjustGoal({ ok: true }, formData);
      addToast({
        title: result.error ?? result.message ?? "Gespeichert",
        color: result.error ? "danger" : "success",
      });
      if (!result.error) setAmount("");
    });
  }

  function remove() {
    if (!window.confirm(`Sparziel „${goal.title}" löschen?`)) return;

    const formData = new FormData();
    formData.set("id", goal.id);

    startTransition(async () => {
      const result = await deleteGoal({ ok: true }, formData);
      addToast({
        title: result.error ?? result.message ?? "Gelöscht",
        color: result.error ? "danger" : "success",
      });
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-default-100/80 bg-content1/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{goal.title}</p>
          <p className="text-tiny text-default-400">
            {done
              ? "Ziel erreicht"
              : `noch ${formatMoney(missing)}`}
            {goal.deadline
              ? ` · bis ${formatDate(goal.deadline)}${
                  days !== null && days >= 0 ? ` (${days} T.)` : " (abgelaufen)"
                }`
              : ""}
          </p>
        </div>
        <span
          className="shrink-0 text-sm font-semibold tabular-nums"
          style={{ color: done ? "#22c55e" : goal.color }}
        >
          {share.toFixed(0)} %
        </span>
      </div>

      <Bar
        value={goal.savedCents}
        max={goal.targetCents}
        color={done ? "#22c55e" : goal.color}
        overColor={goal.color}
      />

      <p className="text-sm tabular-nums">
        {formatMoney(goal.savedCents)}
        <span className="text-default-400"> / {formatMoney(goal.targetCents)}</span>
      </p>

      {goal.note ? (
        <p className="text-tiny text-default-400">{goal.note}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          size="sm"
          variant="bordered"
          inputMode="decimal"
          className="w-28"
          placeholder="Betrag"
          value={amount}
          onValueChange={setAmount}
          endContent={<span className="text-tiny text-default-400">€</span>}
        />
        <Button
          size="sm"
          color="success"
          variant="flat"
          isLoading={pending}
          onPress={() => adjust("deposit")}
        >
          Einzahlen
        </Button>
        <Button
          size="sm"
          variant="light"
          isLoading={pending}
          onPress={() => adjust("withdraw")}
        >
          Entnehmen
        </Button>

        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="light" onPress={() => setEditing(true)}>
            Bearbeiten
          </Button>
          <Button size="sm" variant="light" color="danger" onPress={remove}>
            Löschen
          </Button>
        </div>
      </div>

      {editing ? (
        <GoalDialog
          goal={goal}
          isOpen
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
        />
      ) : null}
    </div>
  );
}
