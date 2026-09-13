"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  addToast,
} from "@heroui/react";
import { deleteCategory, saveCategory, type ActionState } from "@/lib/actions";
import { formatMoney } from "@/lib/money";
import { ActionButton } from "@/components/action-button";
import type { Category, Kind } from "@/lib/types";

const INITIAL: ActionState = { ok: true };

const PRESET_COLORS = [
  "#6366f1", "#22c55e", "#f43f5e", "#f59e0b",
  "#0ea5e9", "#a855f7", "#14b8a6", "#64748b",
];

function CategoryForm({
  kind,
  editing,
  onDone,
}: {
  kind: Kind;
  editing: Category | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveCategory, INITIAL);
  const [color, setColor] = useState(editing?.color ?? PRESET_COLORS[0]);

  useEffect(() => {
    setColor(editing?.color ?? PRESET_COLORS[0]);
  }, [editing]);

  useEffect(() => {
    if (state.ok && state.message) {
      addToast({ title: state.message, color: "success" });
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3" key={editing?.id ?? "new"}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="color" value={color} />
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

      {state.error ? (
        <Alert color="danger" variant="flat" title={state.error} />
      ) : null}

      <div className="flex gap-2">
        <Input
          name="icon"
          aria-label="Symbol"
          placeholder="🏠"
          className="w-20"
          variant="bordered"
          size="sm"
          defaultValue={editing?.icon ?? ""}
        />
        <Input
          isRequired
          name="name"
          aria-label="Name"
          placeholder="Kategoriename"
          variant="bordered"
          size="sm"
          defaultValue={editing?.name ?? ""}
        />
      </div>

      <Input
        name="budget"
        aria-label="Budget"
        size="sm"
        variant="bordered"
        inputMode="decimal"
        placeholder={kind === "expense" ? "Monatsbudget (optional)" : "Zielwert (optional)"}
        defaultValue={
          editing?.budgetCents ? (editing.budgetCents / 100).toFixed(2) : ""
        }
        endContent={<span className="text-small text-default-400">€</span>}
      />

      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-label={`Farbe ${preset}`}
            onClick={() => setColor(preset)}
            className={`h-6 w-6 rounded-full transition-transform ${
              color === preset ? "scale-110 ring-2 ring-foreground/60" : ""
            }`}
            style={{ background: preset }}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" color="primary" isLoading={pending}>
          {editing ? "Speichern" : "Anlegen"}
        </Button>
        {editing ? (
          <Button type="button" size="sm" variant="light" onPress={onDone}>
            Abbrechen
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function CategoryManager({
  kind,
  title,
  categories,
}: {
  kind: Kind;
  title: string;
  categories: Category[];
}) {
  const [editing, setEditing] = useState<Category | null>(null);
  const list = categories.filter((category) => category.kind === kind);

  return (
    <Card className="border border-default-100 bg-content1/60 backdrop-blur">
      <CardHeader className="flex items-center justify-between pb-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Chip size="sm" variant="flat">
          {list.length}
        </Chip>
      </CardHeader>

      <CardBody className="gap-5 p-5">
        <ul className="flex flex-col divide-y divide-default-100">
          {list.length === 0 ? (
            <li className="py-4 text-center text-sm text-default-400">
              Noch keine Kategorien.
            </li>
          ) : (
            list.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                    style={{ backgroundColor: `${category.color}22` }}
                  >
                    {category.icon || "•"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{category.name}</span>
                    {category.budgetCents ? (
                      <span className="text-tiny text-default-400">
                        Budget {formatMoney(category.budgetCents)}
                      </span>
                    ) : null}
                  </span>
                </span>

                <span className="flex gap-1">
                  <Button
                    size="sm"
                    variant="light"
                    onPress={() => setEditing(category)}
                  >
                    Bearbeiten
                  </Button>
                  <ActionButton
                    action={deleteCategory}
                    id={category.id}
                    color="danger"
                    confirm={`Kategorie "${category.name}" löschen? Buchungen bleiben erhalten, verlieren aber die Kategorie.`}
                  >
                    Löschen
                  </ActionButton>
                </span>
              </li>
            ))
          )}
        </ul>

        <div className="rounded-2xl border border-dashed border-default-200 p-4">
          <p className="mb-3 text-tiny uppercase tracking-wide text-default-400">
            {editing ? "Kategorie bearbeiten" : "Neue Kategorie"}
          </p>
          <CategoryForm
            kind={kind}
            editing={editing}
            onDone={() => setEditing(null)}
          />
        </div>
      </CardBody>
    </Card>
  );
}
