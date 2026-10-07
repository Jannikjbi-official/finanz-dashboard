"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { deleteCategory, saveCategory } from "@/lib/actions";
import { ActionForm, FormError } from "@/ui/action-form";
import { ActionButton } from "@/ui/action-button";
import { Button } from "@/ui/button";
import { AmountInput, Field, Input, Segmented } from "@/ui/field";
import { Swatch } from "@/ui/layout";
import { Money } from "@/ui/money";
import { Sheet } from "@/ui/sheet";
import { centsToInput } from "@/features/shared/types";

export type CategoryRow = {
  id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
  budgetCents: number | null;
  usage: number;
};

const PALETTE = ["#c6f24e", "#8be36b", "#6ee7d8", "#38bdf8", "#8b9cff", "#c084fc", "#f472b6", "#ff6b6b", "#ff9a52", "#f5c451", "#a3e635", "#9aa3ad"];

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState<"income" | "expense" | null>(null);

  const groups: Array<{ kind: "expense" | "income"; title: string }> = [
    { kind: "expense", title: "Ausgaben" },
    { kind: "income", title: "Einnahmen" },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <section key={group.kind} className="card">
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <h2 className="text-[15px] font-semibold">{group.title}</h2>
              <Button size="sm" variant="ghost" onClick={() => setCreating(group.kind)}>
                <Plus size={13} weight="bold" /> Kategorie
              </Button>
            </div>
            <ul>
              {categories
                .filter((c) => c.kind === group.kind)
                .map((category) => (
                  <li key={category.id}>
                    <button type="button" onClick={() => setEditing(category)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-line py-3 text-left hover:bg-surface-2 sm:grid-cols-[1fr_8rem_8rem]">
                      <span className="flex items-center gap-2.5 text-[14px]">
                        <Swatch color={category.color} className="size-2.5" />
                        {category.name}
                      </span>
                      <span className="hidden text-right text-[13px] text-ink-3 sm:block">{category.usage} Buchungen</span>
                      <span className="text-right text-[13px] text-ink-2">
                        {category.budgetCents ? (
                          <>
                            Budget <Money cents={category.budgetCents} whole />
                          </>
                        ) : (
                          ""
                        )}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>

      <CategorySheet
        key={editing?.id ?? `new-${creating}`}
        open={editing !== null || creating !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setCreating(null);
          }
        }}
        category={editing}
        kind={editing?.kind ?? creating ?? "expense"}
      />
    </>
  );
}

function CategorySheet({
  open,
  onOpenChange,
  category,
  kind: initialKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryRow | null;
  kind: "income" | "expense";
}) {
  const [kind, setKind] = useState(initialKind);
  const [color, setColor] = useState(category?.color ?? PALETTE[0]);
  const formId = category ? `cat-${category.id}` : "cat-new";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={category ? "Kategorie bearbeiten" : "Kategorie anlegen"}
      footer={
        <div className="flex items-center justify-between gap-2">
          {category ? (
            <ActionButton action={deleteCategory} fields={{ id: category.id }} variant="ghost" size="md" className="text-neg" onDone={() => onOpenChange(false)}>
              Löschen
            </ActionButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button variant="primary" type="submit" form={formId}>
              Speichern
            </Button>
          </div>
        </div>
      }
    >
      <ActionForm id={formId} action={saveCategory} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
        {({ error }) => (
          <>
            {category ? <input type="hidden" name="id" value={category.id} /> : null}
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="color" value={color} />
            <input type="hidden" name="icon" value="" />
            {!category ? (
              <Segmented
                name="cat-kind"
                value={kind}
                onChange={setKind}
                className="w-full"
                options={[
                  { value: "expense", label: "Ausgabe" },
                  { value: "income", label: "Einnahme" },
                ]}
              />
            ) : null}
            <Field label="Name" htmlFor="cat-name">
              <Input id="cat-name" name="name" required maxLength={40} defaultValue={category?.name} />
            </Field>
            {kind === "expense" ? (
              <Field label="Monatsbudget" htmlFor="cat-budget" optional>
                <AmountInput id="cat-budget" name="budget" defaultValue={centsToInput(category?.budgetCents)} className="max-w-48" />
              </Field>
            ) : null}
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-2">Farbe</legend>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`Farbe ${value}`}
                    aria-pressed={color === value}
                    onClick={() => setColor(value)}
                    className="size-7 rounded-xs ring-offset-2 ring-offset-paper aria-pressed:ring-2 aria-pressed:ring-ink"
                    style={{ background: value }}
                  />
                ))}
              </div>
            </fieldset>
            {category && category.usage > 0 ? (
              <p className="text-[13px] text-ink-3">Beim Löschen bleiben die {category.usage} Buchungen erhalten, aber ohne Kategorie.</p>
            ) : null}
            <FormError error={error} />
          </>
        )}
      </ActionForm>
    </Sheet>
  );
}
