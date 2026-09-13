"use client";

import { useState, useTransition } from "react";
import { Button, Input, Popover, PopoverContent, PopoverTrigger, addToast } from "@heroui/react";
import { setCategoryBudget } from "@/lib/actions";
import { formatMoney } from "@/lib/money";
import { Bar } from "@/components/ui";
import type { Category } from "@/lib/types";

export function BudgetRow({
  category,
  spentCents,
  averageCents,
}: {
  category: Category;
  spentCents: number;
  averageCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    category.budgetCents ? (category.budgetCents / 100).toFixed(2) : "",
  );
  const [pending, startTransition] = useTransition();

  const budget = category.budgetCents ?? 0;
  const share = budget > 0 ? (spentCents / budget) * 100 : 0;
  const rest = budget - spentCents;

  function save(next: string) {
    const formData = new FormData();
    formData.set("id", category.id);
    formData.set("budget", next);

    startTransition(async () => {
      const result = await setCategoryBudget({ ok: true }, formData);
      addToast({
        title: result.error ?? result.message ?? "Gespeichert",
        color: result.error ? "danger" : "success",
      });
      if (!result.error) setOpen(false);
    });
  }

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm"
          style={{ backgroundColor: `${category.color}1f` }}
        >
          {category.icon || "•"}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{category.name}</p>
          <p className="text-tiny text-default-400">
            {budget > 0 ? (
              <>
                {formatMoney(spentCents)} von {formatMoney(budget)}
                {rest >= 0 ? (
                  <span className="text-default-400">
                    {" "}
                    · {formatMoney(rest)} übrig
                  </span>
                ) : (
                  <span className="text-danger">
                    {" "}
                    · {formatMoney(Math.abs(rest))} drüber
                  </span>
                )}
              </>
            ) : (
              <>
                {formatMoney(spentCents)} diesen Monat
                {averageCents > 0
                  ? ` · Ø ${formatMoney(averageCents)} (3 Monate)`
                  : ""}
              </>
            )}
          </p>
        </div>

        <Popover isOpen={open} onOpenChange={setOpen} placement="left">
          <PopoverTrigger>
            <Button size="sm" variant="flat" isLoading={pending}>
              {budget > 0 ? `${share.toFixed(0)} %` : "Budget setzen"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 gap-3 p-4">
            <p className="w-full text-tiny text-default-400">
              Monatsbudget für {category.name}
            </p>
            <Input
              autoFocus
              size="sm"
              variant="bordered"
              inputMode="decimal"
              value={value}
              onValueChange={setValue}
              placeholder={
                averageCents > 0
                  ? `Ø ${(averageCents / 100).toFixed(2)}`
                  : "z.B. 150"
              }
              endContent={<span className="text-small text-default-400">€</span>}
            />
            <div className="flex w-full gap-2">
              <Button
                size="sm"
                color="primary"
                className="flex-1"
                isLoading={pending}
                onPress={() => save(value)}
              >
                Speichern
              </Button>
              {budget > 0 ? (
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setValue("");
                    save("");
                  }}
                >
                  Entfernen
                </Button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {budget > 0 ? (
        <Bar value={spentCents} max={budget} color={category.color} />
      ) : null}
    </li>
  );
}
