"use client";

import { useState, useTransition } from "react";
import {
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Button,
  addToast,
} from "@heroui/react";
import {
  bookRecurring,
  deleteRecurring,
  toggleRecurring,
  type ActionState,
} from "@/lib/actions";
import { INTERVAL_LABEL, daysUntil, monthlyAmount, yearlyAmount } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/money";
import { Amount, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icon";
import { RecurringDialog } from "@/components/recurring-dialog";
import type { Category, Kind, Recurring } from "@/lib/types";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function dueLabel(entry: Recurring) {
  if (!entry.active) return "pausiert";
  const days = daysUntil(entry.nextDue);
  if (days < 0) return "überfällig";
  if (days === 0) return "heute fällig";
  if (days === 1) return "morgen";
  return `in ${days} Tagen`;
}

export function RecurringList({
  entries,
  categories,
  lockType,
  emptyTitle = "Noch nichts angelegt.",
  emptyHint,
}: {
  entries: Recurring[];
  categories: Category[];
  lockType?: Kind;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: Action, id: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;

    const formData = new FormData();
    formData.set("id", id);

    startTransition(async () => {
      const result = await action({ ok: true }, formData);
      addToast({
        title: result.error ?? result.message ?? "Erledigt",
        color: result.error ? "danger" : "success",
      });
    });
  }

  if (entries.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-default-100/70">
        {entries.map((entry) => {
          const category = entry.categoryId ? byId.get(entry.categoryId) : undefined;
          const perMonth = monthlyAmount(entry.amountCents, entry.interval);
          const overdue = entry.active && daysUntil(entry.nextDue) <= 0;

          return (
            <li
              key={entry.id}
              className={`flex items-center gap-3 py-3 first:pt-0 last:pb-0 ${
                entry.active ? "" : "opacity-55"
              }`}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ backgroundColor: `${category?.color ?? "#64748b"}1f` }}
              >
                {category?.icon || "•"}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.title}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-tiny text-default-400">
                  <span>{INTERVAL_LABEL[entry.interval]}</span>
                  <span aria-hidden>·</span>
                  <span className={overdue ? "text-warning" : undefined}>
                    {dueLabel(entry)}
                  </span>
                  <span className="hidden sm:inline" aria-hidden>
                    ·
                  </span>
                  <span className="hidden sm:inline">
                    {formatDate(entry.nextDue)}
                  </span>
                </p>
              </div>

              <div className="shrink-0 text-right">
                <Amount
                  cents={entry.amountCents}
                  kind={entry.type}
                  signed={false}
                  className="text-sm font-medium"
                />
                <p className="text-tiny text-default-400">
                  {entry.interval === "monthly"
                    ? `${formatMoney(yearlyAmount(entry.amountCents, entry.interval))} / Jahr`
                    : `${formatMoney(perMonth)} / Monat`}
                </p>
              </div>

              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    isDisabled={pending}
                    aria-label={`Aktionen für ${entry.title}`}
                  >
                    <Icon name="more" size={18} />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Aktionen">
                  <DropdownItem
                    key="book"
                    description="Fällige Zahlung als Buchung übernehmen"
                    onPress={() => run(bookRecurring, entry.id)}
                  >
                    Buchen
                  </DropdownItem>
                  <DropdownItem
                    key="toggle"
                    onPress={() => run(toggleRecurring, entry.id)}
                  >
                    {entry.active ? "Pausieren" : "Fortsetzen"}
                  </DropdownItem>
                  <DropdownItem key="edit" onPress={() => setEditing(entry)}>
                    Bearbeiten
                  </DropdownItem>
                  <DropdownItem
                    key="delete"
                    color="danger"
                    className="text-danger"
                    onPress={() =>
                      run(
                        deleteRecurring,
                        entry.id,
                        `„${entry.title}" wirklich löschen?`,
                      )
                    }
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
        <RecurringDialog
          key={editing.id}
          categories={categories}
          entry={editing}
          lockType={lockType}
          isOpen
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}

/** Kleiner Hinweis-Chip fuer faellige Abos, z.B. im Seitenkopf. */
export function DueChip({ entries }: { entries: Recurring[] }) {
  const due = entries.filter(
    (entry) => entry.active && daysUntil(entry.nextDue) <= 0,
  ).length;

  if (due === 0) return null;

  return (
    <Chip size="sm" color="warning" variant="flat">
      {due} fällig
    </Chip>
  );
}
