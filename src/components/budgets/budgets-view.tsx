"use client";

import {
  AlertDialog,
  Button,
  Card,
  Chip,
  FieldError,
  Form,
  Input,
  Label,
  Meter,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast,
} from "@heroui/react";
import { AlertTriangle, Pencil, PiggyBank, Plus, Tags, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CATEGORY_ICONS, CategoryIcon } from "@/components/common/category-icon";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { ColorInput } from "@/components/forms/color-input";
import { MoneyField } from "@/components/forms/fields";
import { formatMonth } from "@/lib/dates";
import { budgetLevel, levelColor } from "@/lib/finance";
import { eurosToCents, formatCents, formatPercent } from "@/lib/money";
import { deleteCategory, saveCategory, setCategoryBudget } from "@/server/actions";

interface CategoryWithSpend {
  id: string;
  name: string;
  color: string;
  icon: string;
  budgetCents: number | null;
  spentCents: number;
  expenseCount: number;
}

export function BudgetsView({ month, categories }: { month: string; categories: CategoryWithSpend[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryWithSpend | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [toDelete, setToDelete] = useState<CategoryWithSpend | null>(null);
  const router = useRouter();

  const withBudget = categories.filter((c) => c.budgetCents);
  const totalBudget = withBudget.reduce((a, c) => a + (c.budgetCents ?? 0), 0);
  const totalSpent = withBudget.reduce((a, c) => a + c.spentCents, 0);
  const totalLevel = budgetLevel(totalSpent, totalBudget);

  const openForm = (c: CategoryWithSpend | null) => {
    setEditing(c);
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <Card className="rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted">Budgets gesamt · {formatMonth(month)}</p>
            <p className="tabular text-3xl font-semibold tracking-tight">
              {formatCents(totalSpent)} <span className="text-lg font-normal text-muted">von {formatCents(totalBudget)}</span>
            </p>
          </div>
          <Button onPress={() => openForm(null)}>
            <Plus className="size-4" /> Kategorie
          </Button>
        </div>
        {totalBudget > 0 && (
          <Meter
            className="mt-5"
            value={Math.min(totalSpent, totalBudget)}
            maxValue={totalBudget}
            color={levelColor(totalLevel)}
            aria-label="Gesamtbudget"
            valueLabel={formatPercent(totalSpent / totalBudget)}
          >
            <Meter.Track className="h-3">
              <Meter.Fill />
            </Meter.Track>
          </Meter>
        )}
      </Card>

      <section aria-label="Kategorien" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((c) => (
          <BudgetCard key={c.id} category={c} onEdit={() => openForm(c)} onDelete={() => setToDelete(c)} />
        ))}
      </section>

      <ResponsiveSheet
        isOpen={open}
        onOpenChange={setOpen}
        title={editing ? "Kategorie bearbeiten" : "Neue Kategorie"}
        icon={<Tags className="size-5" />}
      >
        <CategoryForm key={formKey} initial={editing} onDone={() => setOpen(false)} />
      </ResponsiveSheet>

      <AlertDialog>
        <AlertDialog.Backdrop isOpen={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[420px]">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Kategorie „{toDelete?.name}“ löschen?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  {toDelete?.expenseCount
                    ? `${toDelete.expenseCount} Ausgaben behalten ihren Betrag, sind danach aber „Ohne Kategorie“.`
                    : "Es sind keine Ausgaben zugeordnet."}
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Abbrechen
                </Button>
                <Button
                  variant="danger"
                  onPress={async () => {
                    if (!toDelete) return;
                    const res = await deleteCategory(toDelete.id);
                    setToDelete(null);
                    if (res.ok) {
                      toast.success("Kategorie gelöscht");
                      router.refresh();
                    } else toast.danger(res.error);
                  }}
                >
                  Löschen
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  );
}

function BudgetCard({
  category: c,
  onEdit,
  onDelete,
}: {
  category: CategoryWithSpend;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [budget, setBudget] = useState<number | null>(c.budgetCents ? c.budgetCents / 100 : null);
  const [pending, start] = useTransition();
  const level = budgetLevel(c.spentCents, c.budgetCents);
  const dirty = (budget ? eurosToCents(budget) : null) !== (c.budgetCents ?? null);

  const save = () =>
    start(async () => {
      const res = await setCategoryBudget(c.id, budget ? eurosToCents(budget) : null);
      if (res.ok) {
        toast.success(budget ? `Budget für ${c.name}: ${formatCents(eurosToCents(budget))}` : `Budget für ${c.name} entfernt`);
        router.refresh();
      } else toast.danger(res.error);
    });

  return (
    <Card className="animate-fade-up gap-4 rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={c.icon} color={c.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{c.name}</p>
          <p className="tabular text-sm text-muted">
            {formatCents(c.spentCents)} ausgegeben
          </p>
        </div>
        {level !== "ok" && (
          <Chip size="sm" variant="soft" color={levelColor(level)}>
            <AlertTriangle className="size-3" />
            <Chip.Label>{level === "over" ? "Überschritten" : "80 %"}</Chip.Label>
          </Chip>
        )}
        <Button isIconOnly size="sm" variant="ghost" aria-label={`${c.name} bearbeiten`} onPress={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button isIconOnly size="sm" variant="ghost" aria-label={`${c.name} löschen`} onPress={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      {c.budgetCents ? (
        <Meter
          value={Math.min(c.spentCents, c.budgetCents)}
          maxValue={c.budgetCents}
          color={levelColor(level)}
          valueLabel={`${formatPercent(c.spentCents / c.budgetCents)} · noch ${formatCents(Math.max(0, c.budgetCents - c.spentCents))}`}
        >
          <Label className="text-sm font-normal text-muted">Budget {formatCents(c.budgetCents)}</Label>
          <Meter.Output className="tabular text-sm" />
          <Meter.Track>
            <Meter.Fill />
          </Meter.Track>
        </Meter>
      ) : (
        <p className="text-sm text-muted">Kein Monatsbudget festgelegt.</p>
      )}

      <div className="flex items-end gap-2">
        <MoneyField label="Monatsbudget" name={`budget-${c.id}`} value={budget} onChange={setBudget} className="flex-1" />
        <Button variant={dirty ? "primary" : "secondary"} isDisabled={!dirty} isPending={pending} onPress={save} className="mb-0.5">
          Speichern
        </Button>
      </div>
    </Card>
  );
}

function CategoryForm({ initial, onDone }: { initial: CategoryWithSpend | null; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#5b5cf0");
  const [icon, setIcon] = useState(initial?.icon ?? "dots");
  const [budget, setBudget] = useState<number | null>(initial?.budgetCents ? initial.budgetCents / 100 : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const res = await saveCategory({
        id: initial?.id,
        name,
        color,
        icon,
        budgetCents: budget ? eurosToCents(budget) : null,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.danger(res.error);
        return;
      }
      toast.success(initial ? "Kategorie gespeichert" : "Kategorie angelegt", { description: name });
      router.refresh();
      onDone();
    });
  }

  return (
    <Form onSubmit={submit} validationErrors={errors} validationBehavior="aria" className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-2xl bg-surface-secondary p-4">
        <CategoryIcon icon={icon} color={color} size="lg" />
        <span className="font-semibold">{name || "Vorschau"}</span>
      </div>
      <TextField name="name" value={name} onChange={setName} isRequired autoFocus maxLength={40}>
        <Label>Name</Label>
        <Input placeholder="z. B. Haustier" />
        <FieldError />
      </TextField>
      <ColorInput label="Farbe" value={color} onChange={setColor} />
      <div className="flex flex-col gap-2">
        <Label id="icon-label">Icon</Label>
        <ToggleButtonGroup
          aria-labelledby="icon-label"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([icon])}
          onSelectionChange={(keys) => {
            const k = [...keys][0];
            if (k) setIcon(String(k));
          }}
          className="grid grid-cols-6 gap-1.5 sm:grid-cols-8"
          isDetached
        >
          {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, label }]) => (
            <ToggleButton key={key} id={key} isIconOnly aria-label={label} className="size-11 rounded-xl">
              <Icon className="size-5" />
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <MoneyField
        label="Monatsbudget"
        name="budgetCents"
        value={budget}
        onChange={setBudget}
        description="Optional – Warnung bei 80 % und 100 %."
      />
      <Button type="submit" size="lg" fullWidth isPending={pending} className="h-12 rounded-2xl">
        <PiggyBank className="size-4" /> {initial ? "Speichern" : "Kategorie anlegen"}
      </Button>
    </Form>
  );
}
