"use client";

import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Disclosure,
  Dropdown,
  FieldError,
  Form,
  Input,
  Label,
  ProgressBar,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast,
} from "@heroui/react";
import { ArrowDownUp, Check, ExternalLink, Gift, MoreHorizontal, Pencil, PiggyBank, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Empty } from "@/components/common/empty";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { CategoryPicker, MoneyField } from "@/components/forms/fields";
import { useQuickAdd } from "@/components/shell/quick-add";
import { formatDate } from "@/lib/dates";
import type { Wish } from "@/lib/db/schema";
import { PRIORITIES, type PriorityId, labelOf } from "@/lib/finance";
import { eurosToCents, formatCents, formatPercent } from "@/lib/money";
import { addWishSavings, deleteWish, purchaseWish, saveWish } from "@/server/actions";

type SortKey = "prioritaet" | "preis" | "fortschritt" | "neu";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "prioritaet", label: "Priorität" },
  { id: "preis", label: "Preis" },
  { id: "fortschritt", label: "Fortschritt" },
  { id: "neu", label: "Neueste" },
];

export function WishlistView({
  wishes,
  purchased,
  leftThisMonthCents,
}: {
  wishes: Wish[];
  purchased: Wish[];
  leftThisMonthCents: number;
}) {
  const [sort, setSort] = useState<SortKey>("prioritaet");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Wish | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [buying, setBuying] = useState<Wish | null>(null);

  const sorted = useMemo(() => {
    const rank = (p: string) => PRIORITIES.find((x) => x.id === p)?.rank ?? 9;
    const progress = (w: Wish) => w.savedCents / w.priceCents;
    return [...wishes].sort((a, b) => {
      switch (sort) {
        case "preis":
          return a.priceCents - b.priceCents;
        case "fortschritt":
          return progress(b) - progress(a);
        case "neu":
          return +new Date(b.createdAt) - +new Date(a.createdAt);
        default:
          return rank(a.priority) - rank(b.priority) || progress(b) - progress(a);
      }
    });
  }, [wishes, sort]);

  const totalNeeded = wishes.reduce((a, w) => a + Math.max(0, w.priceCents - w.savedCents), 0);
  const totalSaved = wishes.reduce((a, w) => a + w.savedCents, 0);

  const openForm = (w: Wish | null) => {
    setEditing(w);
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <Chip variant="soft" color="success">
            <PiggyBank className="size-3.5" />
            <Chip.Label>Gespart: {formatCents(totalSaved)}</Chip.Label>
          </Chip>
          <Chip variant="soft">Fehlt noch: {formatCents(totalNeeded)}</Chip>
          <Chip variant="soft" color={leftThisMonthCents > 0 ? "accent" : "danger"}>
            Diesen Monat übrig: {formatCents(leftThisMonthCents)}
          </Chip>
        </div>
        <div className="flex gap-2">
          <Dropdown>
            <Button variant="secondary" aria-label="Sortieren">
              <ArrowDownUp className="size-4" />
              {SORTS.find((s) => s.id === sort)?.label}
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu
                aria-label="Sortierung"
                selectionMode="single"
                selectedKeys={new Set([sort])}
                onSelectionChange={(keys) => {
                  const k = [...(keys as Set<string>)][0];
                  if (k) setSort(k as SortKey);
                }}
              >
                {SORTS.map((s) => (
                  <Dropdown.Item key={s.id} id={s.id} textValue={s.label}>
                    <Label>{s.label}</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <Button onPress={() => openForm(null)}>
            <Plus className="size-4" /> Wunsch
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card className="rounded-3xl">
          <Empty
            icon={<Gift className="size-6" />}
            title="Deine Wunschliste ist leer"
            text="Sammle Dinge, auf die du sparst – mit Sparziel und Fortschritt."
            action={
              <Button onPress={() => openForm(null)}>
                <Plus className="size-4" /> Ersten Wunsch anlegen
              </Button>
            }
          />
        </Card>
      ) : (
        <section aria-label="Wünsche" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((w) => (
            <WishCard
              key={w.id}
              wish={w}
              leftThisMonthCents={leftThisMonthCents}
              onEdit={() => openForm(w)}
              onBuy={() => setBuying(w)}
            />
          ))}
        </section>
      )}

      {purchased.length > 0 && (
        <Disclosure>
          <Disclosure.Heading>
            <Button slot="trigger" variant="ghost" className="w-fit">
              <Check className="size-4" /> Gekauft ({purchased.length})
              <Disclosure.Indicator />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body>
              <ul className="mt-2 flex flex-col gap-1">
                {purchased.map((w) => (
                  <li key={w.id} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm">
                    <span className="truncate">{w.title}</span>
                    <span className="text-muted">
                      {formatCents(w.priceCents)} · {w.purchasedAt ? formatDate(new Date(w.purchasedAt).toISOString().slice(0, 10)) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      )}

      <ResponsiveSheet
        isOpen={open}
        onOpenChange={setOpen}
        title={editing ? "Wunsch bearbeiten" : "Neuer Wunsch"}
        icon={<Gift className="size-5" />}
      >
        <WishForm key={formKey} initial={editing} onDone={() => setOpen(false)} />
      </ResponsiveSheet>

      <PurchaseDialog wish={buying} onClose={() => setBuying(null)} />
    </div>
  );
}

function WishCard({
  wish: w,
  leftThisMonthCents,
  onEdit,
  onBuy,
}: {
  wish: Wish;
  leftThisMonthCents: number;
  onEdit: () => void;
  onBuy: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const remaining = Math.max(0, w.priceCents - w.savedCents);
  const progress = Math.min(1, w.savedCents / w.priceCents);
  const affordable = remaining <= Math.max(0, leftThisMonthCents);
  const prio = PRIORITIES.find((p) => p.id === w.priority)!;

  const addSavings = (sign: 1 | -1) =>
    start(async () => {
      if (!amount) return;
      const res = await addWishSavings(w.id, sign * eurosToCents(amount));
      if (res.ok) {
        toast.success(sign > 0 ? `${formatCents(eurosToCents(amount))} zurückgelegt` : "Betrag entnommen", {
          description: w.title,
        });
        setAmount(null);
        router.refresh();
      } else toast.danger(res.error);
    });

  return (
    <Card className="animate-fade-up gap-0 overflow-hidden rounded-3xl p-0">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[var(--hero-from)] to-[var(--hero-to)]">
        {w.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Gift className="size-12 text-white/80" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Chip size="sm" color={prio.color} variant="primary">
            {prio.label}
          </Chip>
        </div>
        <div className="absolute top-2 right-2">
          <Dropdown>
            <Button isIconOnly size="sm" variant="secondary" aria-label={`Aktionen für ${w.title}`} className="bg-black/40 text-white backdrop-blur">
              <MoreHorizontal className="size-4" />
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu
                aria-label="Aktionen"
                onAction={async (k) => {
                  if (k === "edit") onEdit();
                  if (k === "delete") {
                    const res = await deleteWish(w.id);
                    if (res.ok) {
                      toast.success("Wunsch entfernt");
                      router.refresh();
                    }
                  }
                }}
              >
                <Dropdown.Item id="edit" textValue="Bearbeiten">
                  <Pencil className="size-4 text-muted" />
                  <Label>Bearbeiten</Label>
                </Dropdown.Item>
                <Dropdown.Item id="delete" textValue="Löschen" variant="danger">
                  <Trash2 className="size-4" />
                  <Label>Löschen</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{w.title}</h3>
            {w.note && <p className="line-clamp-2 text-sm text-muted">{w.note}</p>}
          </div>
          <p className="tabular shrink-0 text-xl font-semibold tracking-tight">{formatCents(w.priceCents)}</p>
        </div>
        <Chip size="sm" variant="soft" color={affordable ? "success" : "default"} className="w-fit">
          {affordable ? "Leistbar diesen Monat" : "Noch nicht leistbar"}
        </Chip>
        <ProgressBar value={progress * 100} color={progress >= 1 ? "success" : "accent"} aria-label={`Sparfortschritt ${w.title}`}>
          <Label className="text-sm font-normal text-muted">
            schon gespart: <span className="tabular font-semibold text-foreground">{formatCents(w.savedCents)}</span>
          </Label>
          <ProgressBar.Output className="tabular text-sm">{formatPercent(progress)}</ProgressBar.Output>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        <div className="flex items-end gap-2">
          <MoneyField label="Betrag zurücklegen" name={`sparen-${w.id}`} value={amount} onChange={setAmount} className="flex-1" />
          <Button isIconOnly aria-label="Betrag zurücklegen" isPending={pending} isDisabled={!amount} onPress={() => addSavings(1)} className="mb-0.5">
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="mt-auto flex gap-2">
          {w.url && (
            <Button variant="secondary" className="flex-1" onPress={() => window.open(w.url!, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="size-4" /> Zum Shop
            </Button>
          )}
          <Button variant={progress >= 1 ? "primary" : "tertiary"} className="flex-1" onPress={onBuy}>
            <ShoppingBag className="size-4" /> Gekauft
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PurchaseDialog({ wish, onClose }: { wish: Wish | null; onClose: () => void }) {
  const router = useRouter();
  const { categories } = useQuickAdd();
  const [categoryId, setCategoryId] = useState<string | null>(
    () => categories.find((c) => c.name === "Shopping")?.id ?? null,
  );
  const [pending, start] = useTransition();

  const finish = (asExpense: boolean) =>
    start(async () => {
      if (!wish) return;
      const res = await purchaseWish({ id: wish.id, asExpense, categoryId });
      if (res.ok) {
        toast.success(asExpense ? "Gekauft & als Ausgabe erfasst" : "Als gekauft markiert", { description: wish.title });
        router.refresh();
        onClose();
      } else toast.danger(res.error);
    });

  return (
    <AlertDialog>
      <AlertDialog.Backdrop isOpen={!!wish} onOpenChange={(o) => !o && onClose()}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[440px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="success" />
              <AlertDialog.Heading>„{wish?.title}“ gekauft?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-4">
              <p>
                Soll der Kauf über <strong className="tabular">{wish ? formatCents(wish.priceCents) : ""}</strong> als Ausgabe
                (heute) übernommen werden?
              </p>
              <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} label="Kategorie der Ausgabe" />
            </AlertDialog.Body>
            <AlertDialog.Footer className="flex-wrap">
              <Button variant="tertiary" isDisabled={pending} onPress={() => finish(false)}>
                Nur als gekauft markieren
              </Button>
              <Button isPending={pending} onPress={() => finish(true)}>
                Als Ausgabe übernehmen
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

function WishForm({ initial, onDone }: { initial: Wish | null; onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [price, setPrice] = useState<number | null>(initial ? initial.priceCents / 100 : null);
  const [url, setUrl] = useState(initial?.url ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [priority, setPriority] = useState<PriorityId>((initial?.priority as PriorityId) ?? "mittel");
  const [note, setNote] = useState(initial?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const res = await saveWish({
        id: initial?.id,
        title,
        priceCents: price ? eurosToCents(price) : 0,
        url,
        imageUrl,
        priority,
        note,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.danger(res.error);
        return;
      }
      toast.success(initial ? "Wunsch aktualisiert" : "Wunsch hinzugefügt", { description: title });
      router.refresh();
      onDone();
    });
  }

  return (
    <Form onSubmit={submit} validationErrors={errors} validationBehavior="aria" className="flex flex-col gap-5">
      <TextField name="title" value={title} onChange={setTitle} isRequired autoFocus maxLength={120}>
        <Label>Artikel</Label>
        <Input placeholder="z. B. Kopfhörer" />
        <FieldError />
      </TextField>
      <MoneyField label="Preis" name="priceCents" value={price} onChange={setPrice} isRequired />
      <div className="flex flex-col gap-2">
        <Label id="prio-label">Priorität</Label>
        <ToggleButtonGroup
          aria-labelledby="prio-label"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([priority])}
          onSelectionChange={(keys) => {
            const k = [...keys][0];
            if (k) setPriority(k as PriorityId);
          }}
          fullWidth
        >
          {PRIORITIES.map((p, i) => (
            <ToggleButton key={p.id} id={p.id} className="min-h-11 flex-1">
              {i > 0 && <ToggleButtonGroup.Separator />}
              {labelOf(PRIORITIES, p.id)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <TextField name="url" type="url" value={url} onChange={setUrl} inputMode="url">
        <Label>Link</Label>
        <Input placeholder="https://…" />
        <FieldError />
      </TextField>
      <TextField name="imageUrl" type="url" value={imageUrl} onChange={setImageUrl} inputMode="url">
        <Label>Bild-URL</Label>
        <Input placeholder="https://…/bild.jpg" />
        <FieldError />
      </TextField>
      <TextField name="note" value={note} onChange={setNote} maxLength={500}>
        <Label>Notiz</Label>
        <Input placeholder="optional" />
      </TextField>
      <Button type="submit" size="lg" fullWidth isPending={pending} className="h-12 rounded-2xl">
        {initial ? "Änderungen speichern" : "Wunsch speichern"}
      </Button>
    </Form>
  );
}
