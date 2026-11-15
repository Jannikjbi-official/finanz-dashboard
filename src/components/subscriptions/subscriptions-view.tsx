"use client";

import {
  AlertDialog,
  Button,
  Calendar,
  Card,
  Chip,
  Dropdown,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  TextField,
  toast,
} from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { AlarmClock, CalendarClock, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CategoryIcon } from "@/components/common/category-icon";
import { Empty } from "@/components/common/empty";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { CategoryPicker, type CategoryOption, DateInput, IntervalSelect, MoneyField } from "@/components/forms/fields";
import { formatDate, todayIso } from "@/lib/dates";
import { INTERVALS, type IntervalId, SUBSCRIPTION_STATUS, type SubscriptionStatusId, labelOf } from "@/lib/finance";
import { eurosToCents, formatCents } from "@/lib/money";
import { deleteSubscription, saveSubscription, setSubscriptionStatus } from "@/server/actions";
import type { SubscriptionPageData } from "@/server/queries";

type Sub = SubscriptionPageData["subscriptions"][number];
const DEADLINE_SOON_DAYS = 14;

export function SubscriptionsView({ data }: { data: SubscriptionPageData }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Sub | null>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [toDelete, setToDelete] = useState<Sub | null>(null);
  const [, start] = useTransition();

  const categories: CategoryOption[] = data.categories;
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const soon = data.subscriptions.filter(
    (s) => s.deadlineInDays !== null && s.deadlineInDays >= 0 && s.deadlineInDays <= DEADLINE_SOON_DAYS,
  );

  // Toast-Warnung für bald endende Kündigungsfristen (einmal pro Sitzung)
  useEffect(() => {
    for (const s of soon) {
      const key = `finanzen-deadline-${s.id}-${s.cancellationDeadline}`;
      if (sessionStorage.getItem(key)) continue;
      sessionStorage.setItem(key, "1");
      toast.warning(`Kündigungsfrist für ${s.name} endet bald`, {
        description: `Bis ${formatDate(s.cancellationDeadline!)} – noch ${s.deadlineInDays} Tag${s.deadlineInDays === 1 ? "" : "e"}.`,
        timeout: 10000,
      });
    }
  }, [soon]);

  const openForm = (sub: Sub | null) => {
    setEditing(sub);
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  const changeStatus = (s: Sub, status: SubscriptionStatusId) =>
    start(async () => {
      const res = await setSubscriptionStatus(s.id, status);
      if (res.ok) {
        toast.success(`${s.name}: ${labelOf(SUBSCRIPTION_STATUS, status)}`);
        router.refresh();
      } else toast.danger(res.error);
    });

  const sorted = [...data.subscriptions].sort((a, b) => {
    const rank = { aktiv: 0, pausiert: 1, gekuendigt: 2 } as const;
    return rank[a.status] - rank[b.status] || (a.nextCharge ?? "9").localeCompare(b.nextCharge ?? "9");
  });

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Gesamt-Card */}
        <Card className="relative overflow-hidden rounded-3xl border-0 bg-gradient-to-br from-[var(--hero-from)] to-[var(--hero-to)] p-6 text-white lg:col-span-2">
          <div aria-hidden="true" className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex h-full flex-col justify-between gap-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/80">Alle aktiven Abos</p>
              <Chip size="sm" className="bg-white/15 text-white">
                {data.totals.activeCount} aktiv
              </Chip>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-white/70">pro Monat</p>
                <p className="tabular text-4xl font-semibold tracking-tight sm:text-5xl">{formatCents(data.totals.monthlyCents)}</p>
              </div>
              <div>
                <p className="text-sm text-white/70">pro Jahr</p>
                <p className="tabular text-2xl font-semibold tracking-tight sm:text-4xl">{formatCents(data.totals.yearlyCents)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-white text-[#3b2fc9]" onPress={() => openForm(null)}>
                <Plus className="size-4" /> Abo hinzufügen
              </Button>
              {soon.length > 0 && (
                <Chip className="bg-warning text-warning-foreground">
                  <AlarmClock className="size-3.5" />
                  <Chip.Label>
                    {soon.length} Kündigungsfrist{soon.length === 1 ? "" : "en"} bald
                  </Chip.Label>
                </Chip>
              )}
            </div>
          </div>
        </Card>

        {/* Kalender */}
        <Card className="rounded-3xl p-4">
          <Card.Header className="px-1">
            <Card.Title>Abbuchungskalender</Card.Title>
          </Card.Header>
          <Card.Content className="items-center pt-2">
            <ChargeCalendar chargeDates={data.chargeDates} />
          </Card.Content>
        </Card>
      </div>

      {sorted.length === 0 ? (
        <Card className="rounded-3xl">
          <Empty
            icon={<CalendarClock className="size-6" />}
            title="Noch keine Abos"
            text="Lege Netflix, Spotify & Co. an – sie fließen automatisch in deine Monatsrechnung ein."
            action={
              <Button onPress={() => openForm(null)}>
                <Plus className="size-4" /> Abo hinzufügen
              </Button>
            }
          />
        </Card>
      ) : (
        <section aria-label="Abos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s) => {
            const c = s.categoryId ? catMap.get(s.categoryId) : undefined;
            const status = SUBSCRIPTION_STATUS.find((x) => x.id === s.status)!;
            const deadlineSoon = soon.some((x) => x.id === s.id);
            return (
              <Card key={s.id} className={`animate-fade-up gap-4 rounded-3xl p-5 ${s.status !== "aktiv" ? "opacity-70" : ""}`}>
                <div className="flex items-start gap-3">
                  {c ? <CategoryIcon icon={c.icon} color={c.color} size="lg" /> : <CategoryIcon icon="receipt" color="#8b8d98" size="lg" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="text-sm text-muted">
                      {formatCents(s.priceCents)} · {labelOf(INTERVALS, s.interval)}
                    </p>
                  </div>
                  <Dropdown>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={`Aktionen für ${s.name}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                    <Dropdown.Popover placement="bottom end">
                      <Dropdown.Menu
                        aria-label="Aktionen"
                        onAction={(k) => {
                          if (k === "edit") openForm(s);
                          else if (k === "delete") setToDelete(s);
                          else changeStatus(s, k as SubscriptionStatusId);
                        }}
                        disabledKeys={[s.status]}
                      >
                        <Dropdown.Item id="edit" textValue="Bearbeiten">
                          <Pencil className="size-4 text-muted" />
                          <Label>Bearbeiten</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="aktiv" textValue="Aktivieren">
                          <Play className="size-4 text-muted" />
                          <Label>Aktiv</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="pausiert" textValue="Pausieren">
                          <Pause className="size-4 text-muted" />
                          <Label>Pausieren</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="gekuendigt" textValue="Gekündigt">
                          <XCircle className="size-4 text-muted" />
                          <Label>Als gekündigt markieren</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="delete" textValue="Löschen" variant="danger">
                          <Trash2 className="size-4" />
                          <Label>Löschen</Label>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-secondary p-3">
                  <div>
                    <p className="text-xs text-muted">pro Monat</p>
                    <p className="tabular font-semibold">{formatCents(s.monthlyCents)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">pro Jahr</p>
                    <p className="tabular font-semibold">{formatCents(s.yearlyCents)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" variant="soft" color={status.color}>
                    {status.label}
                  </Chip>
                  {s.status === "aktiv" && s.nextCharge && (
                    <Chip size="sm" variant="soft">
                      Nächste: {formatDate(s.nextCharge)}
                    </Chip>
                  )}
                  {deadlineSoon && (
                    <Chip size="sm" variant="soft" color="warning">
                      <AlarmClock className="size-3" />
                      <Chip.Label>Kündigungsfrist endet bald</Chip.Label>
                    </Chip>
                  )}
                  {s.cancellationDeadline && !deadlineSoon && s.status !== "gekuendigt" && (
                    <Chip size="sm" variant="soft">
                      Frist: {formatDate(s.cancellationDeadline)}
                    </Chip>
                  )}
                </div>
                {s.note && <p className="text-sm text-muted">{s.note}</p>}
              </Card>
            );
          })}
        </section>
      )}

      <ResponsiveSheet
        isOpen={open}
        onOpenChange={setOpen}
        title={editing ? "Abo bearbeiten" : "Neues Abo"}
        icon={<CalendarClock className="size-5" />}
      >
        <SubscriptionForm key={formKey} initial={editing} categories={categories} onDone={() => setOpen(false)} />
      </ResponsiveSheet>

      <AlertDialog>
        <AlertDialog.Backdrop isOpen={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>„{toDelete?.name}“ löschen?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>Das Abo wird entfernt und taucht nicht mehr in deiner Monatsrechnung auf.</p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Abbrechen
                </Button>
                <Button
                  variant="danger"
                  onPress={async () => {
                    if (!toDelete) return;
                    const res = await deleteSubscription(toDelete.id);
                    setToDelete(null);
                    if (res.ok) {
                      toast.success("Abo gelöscht");
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

function ChargeCalendar({ chargeDates }: { chargeDates: SubscriptionPageData["chargeDates"] }) {
  const byDate = useMemo(() => {
    const m = new Map<string, { name: string; cents: number }[]>();
    for (const c of chargeDates) m.set(c.date, [...(m.get(c.date) ?? []), c]);
    return m;
  }, [chargeDates]);
  const [selected, setSelected] = useState<CalendarDate | null>(null);
  const items = selected ? (byDate.get(selected.toString()) ?? []) : [];
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Calendar aria-label="Abbuchungstage" firstDayOfWeek="mon" value={selected} onChange={setSelected}>
        <Calendar.Header>
          <Calendar.Heading />
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>
            {(date) => (
              <Calendar.Cell date={date} aria-label={byDate.has(date.toString()) ? `${date.day}. – Abbuchung` : undefined}>
                {({ formattedDate }) => (
                  <>
                    {formattedDate}
                    {byDate.has(date.toString()) && <Calendar.CellIndicator />}
                  </>
                )}
              </Calendar.Cell>
            )}
          </Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>
      <div className="min-h-10 w-full text-sm" aria-live="polite">
        {selected &&
          (items.length ? (
            <ul className="flex flex-col gap-1">
              {items.map((i) => (
                <li key={i.name} className="flex justify-between rounded-xl bg-surface-secondary px-3 py-1.5">
                  <span>{i.name}</span>
                  <span className="tabular font-medium">{formatCents(i.cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted">Keine Abbuchung am {formatDate(selected.toString())}</p>
          ))}
      </div>
    </div>
  );
}

function SubscriptionForm({
  initial,
  categories,
  onDone,
}: {
  initial: Sub | null;
  categories: CategoryOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState<number | null>(initial ? initial.priceCents / 100 : null);
  const [interval, setInterval] = useState<IntervalId | null>(initial?.interval ?? "monatlich");
  const [billingDay, setBillingDay] = useState<number>(initial?.billingDay ?? new Date().getDate());
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [startDate, setStartDate] = useState<string | null>(initial?.startDate ?? todayIso());
  const [deadline, setDeadline] = useState<string | null>(initial?.cancellationDeadline ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [status, setStatus] = useState<SubscriptionStatusId>(initial?.status ?? "aktiv");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const res = await saveSubscription({
        id: initial?.id,
        name,
        priceCents: price ? eurosToCents(price) : 0,
        interval,
        billingDay,
        categoryId,
        startDate,
        cancellationDeadline: deadline,
        note,
        status,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.danger(res.error);
        return;
      }
      toast.success(initial ? "Abo aktualisiert" : "Abo angelegt", { description: name });
      router.refresh();
      onDone();
    });
  }

  return (
    <Form onSubmit={submit} validationErrors={errors} validationBehavior="aria" className="flex flex-col gap-5">
      <TextField name="name" value={name} onChange={setName} isRequired autoFocus maxLength={80}>
        <Label>Name</Label>
        <Input placeholder="z. B. Netflix" />
        <FieldError />
      </TextField>
      <div className="grid gap-5 sm:grid-cols-2">
        <MoneyField label="Preis" name="priceCents" value={price} onChange={setPrice} isRequired />
        <IntervalSelect value={interval} onChange={setInterval} isRequired />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField
          name="billingDay"
          value={billingDay}
          onChange={(v) => setBillingDay(Number.isNaN(v) ? 1 : v)}
          minValue={1}
          maxValue={31}
          isRequired
          fullWidth
        >
          <Label>Abbuchungstag</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input className="tabular text-center" />
            <NumberField.IncrementButton />
          </NumberField.Group>
          <FieldError />
        </NumberField>
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <DateInput label="Startdatum" name="startDate" value={startDate} onChange={setStartDate} isRequired />
        <DateInput
          label="Kündigungsfrist"
          name="cancellationDeadline"
          value={deadline}
          onChange={setDeadline}
          description="Letzter Tag, um zu kündigen (optional)"
        />
      </div>
      <Select name="status" value={status} onChange={(k) => k && setStatus(k as SubscriptionStatusId)} fullWidth>
        <Label>Status</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {SUBSCRIPTION_STATUS.map((s) => (
              <ListBox.Item key={s.id} id={s.id} textValue={s.label}>
                {s.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <TextField name="note" value={note} onChange={setNote} maxLength={500}>
        <Label>Notiz</Label>
        <Input placeholder="optional" />
      </TextField>
      <Button type="submit" size="lg" fullWidth isPending={pending} className="h-12 rounded-2xl">
        {initial ? "Änderungen speichern" : "Abo speichern"}
      </Button>
    </Form>
  );
}
