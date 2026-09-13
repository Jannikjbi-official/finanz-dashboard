"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
  useDisclosure,
} from "@heroui/react";
import { deleteRefund, receiveRefund } from "@/lib/actions";
import { daysUntil, todayISO } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/icon";
import { RefundDialog } from "@/components/refund-dialog";
import type { Account, Category, Refund } from "@/lib/types";

function expectedLabel(refund: Refund) {
  if (refund.status === "received") {
    return refund.receivedDate
      ? `erhalten am ${formatDate(refund.receivedDate)}`
      : "erhalten";
  }

  if (!refund.expectedFrom) return "Zeitpunkt unbekannt";

  if (refund.expectedTo && refund.expectedTo !== refund.expectedFrom) {
    return `erwartet ${formatDate(refund.expectedFrom)} – ${formatDate(refund.expectedTo)}`;
  }

  const days = daysUntil(refund.expectedFrom);
  if (days < 0) return `überfällig seit ${formatDate(refund.expectedFrom)}`;
  if (days === 0) return "heute erwartet";
  return `erwartet am ${formatDate(refund.expectedFrom)}`;
}

export function RefundList({
  refunds,
  categories,
  accounts,
}: {
  refunds: Refund[];
  categories: Category[];
  accounts: Account[];
}) {
  const [editing, setEditing] = useState<Refund | null>(null);
  const [receiving, setReceiving] = useState<Refund | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(refund: Refund) {
    if (!window.confirm(`„${refund.title}" wirklich löschen?`)) return;

    const formData = new FormData();
    formData.set("id", refund.id);

    startTransition(async () => {
      const result = await deleteRefund({ ok: true }, formData);
      addToast({
        title: result.error ?? result.message ?? "Gelöscht",
        color: result.error ? "danger" : "success",
      });
    });
  }

  if (refunds.length === 0) {
    return (
      <EmptyState
        title="Keine offenen Erstattungen."
        hint="Trag ein, was dir noch zurückgezahlt wird – auch wenn du nicht weißt, wann."
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-default-100/70">
        {refunds.map((refund) => {
          const category = categories.find(
            (entry) => entry.id === refund.categoryId,
          );
          const open = refund.status === "open";
          const overdue =
            open &&
            refund.expectedFrom !== null &&
            daysUntil(refund.expectedTo ?? refund.expectedFrom) < 0;

          return (
            <li
              key={refund.id}
              className={`flex items-start gap-3 py-3 first:pt-0 last:pb-0 ${
                open ? "" : "opacity-60"
              }`}
            >
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ backgroundColor: `${category?.color ?? "#22c55e"}1f` }}
              >
                {category?.icon || "↩"}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="truncate">{refund.title}</span>
                  {!open ? (
                    <Chip size="sm" variant="flat" color="success" className="h-5 text-[0.65rem]">
                      erhalten
                    </Chip>
                  ) : !refund.expectedFrom ? (
                    <Chip size="sm" variant="flat" className="h-5 text-[0.65rem]">
                      offen
                    </Chip>
                  ) : overdue ? (
                    <Chip size="sm" variant="flat" color="warning" className="h-5 text-[0.65rem]">
                      überfällig
                    </Chip>
                  ) : null}
                </p>
                <p className="text-tiny text-default-400">
                  {expectedLabel(refund)}
                  {category ? ` · ${category.name}` : ""}
                </p>
                {refund.note ? (
                  <p className="mt-0.5 line-clamp-2 text-tiny text-default-500">
                    {refund.note}
                  </p>
                ) : null}
              </div>

              <span className="mt-0.5 shrink-0 text-sm font-medium tabular-nums text-success">
                {formatMoney(refund.amountCents)}
              </span>

              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    isDisabled={pending}
                    aria-label={`Aktionen für ${refund.title}`}
                  >
                    <Icon name="more" size={18} />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Aktionen" disabledKeys={open ? [] : ["receive"]}>
                  <DropdownItem
                    key="receive"
                    description="Als Einnahme buchen"
                    onPress={() => setReceiving(refund)}
                  >
                    Erhalten
                  </DropdownItem>
                  <DropdownItem key="edit" onPress={() => setEditing(refund)}>
                    Bearbeiten
                  </DropdownItem>
                  <DropdownItem
                    key="delete"
                    color="danger"
                    className="text-danger"
                    onPress={() => remove(refund)}
                  >
                    Löschen
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </li>
          );
        })}
      </ul>

      {editing ? (
        <RefundDialog
          key={editing.id}
          categories={categories}
          accounts={accounts}
          refund={editing}
          isOpen
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}

      {receiving ? (
        <ReceiveDialog
          key={receiving.id}
          refund={receiving}
          onDone={() => setReceiving(null)}
        />
      ) : null}
    </>
  );
}

/** Beim Eingang kann der Betrag abweichen, deshalb ein eigener Dialog. */
function ReceiveDialog({
  refund,
  onDone,
}: {
  refund: Refund;
  onDone: () => void;
}) {
  const { isOpen, onOpenChange } = useDisclosure({ defaultOpen: true });
  const [amount, setAmount] = useState((refund.amountCents / 100).toFixed(2));
  const [date, setDate] = useState(todayISO());
  const [pending, startTransition] = useTransition();

  function submit() {
    const formData = new FormData();
    formData.set("id", refund.id);
    formData.set("amount", amount);
    formData.set("date", date);

    startTransition(async () => {
      const result = await receiveRefund({ ok: true }, formData);
      addToast({
        title: result.error ?? result.message ?? "Gebucht",
        color: result.error ? "danger" : "success",
      });
      if (!result.error) onDone();
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        onOpenChange();
        if (!open) onDone();
      }}
      placement="center"
    >
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-1">
          Erstattung erhalten
        </ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-sm text-default-500">
            „{refund.title}" wird als Einnahme gebucht.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Tatsächlicher Betrag"
              variant="bordered"
              inputMode="decimal"
              value={amount}
              onValueChange={setAmount}
              endContent={<span className="text-small text-default-400">€</span>}
            />
            <Input
              type="date"
              label="Eingegangen am"
              variant="bordered"
              value={date}
              onValueChange={setDate}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onDone}>
            Abbrechen
          </Button>
          <Button color="success" onPress={submit} isLoading={pending}>
            Buchen
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
