"use client";

import {
  Button,
  Card,
  Chip,
  ComboBox,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Tabs,
  Tag,
  TagGroup,
  TextField,
  toast,
} from "@heroui/react";
import { Plus, Repeat, Square, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChartLegend, IncomeBars, IncomeExpenseBars } from "@/components/charts/lazy";
import { Empty } from "@/components/common/empty";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { DateInput, IntervalSelect, MoneyField, SwitchRow } from "@/components/forms/fields";
import { enqueue, isNetworkError } from "@/lib/client/offline-queue";
import { formatDate, formatMonth, todayIso } from "@/lib/dates";
import { DEFAULT_INCOME_SOURCES, INTERVALS, type IntervalId, labelOf } from "@/lib/finance";
import { eurosToCents, formatCents, formatPercent } from "@/lib/money";
import { createIncome, deleteIncomes, restoreIncomes, stopRecurringRule } from "@/server/actions";
import type { IncomeRow } from "@/server/queries";

type IncomePageData = {
  month: string;
  year: number;
  monthRows: IncomeRow[];
  yearRows: IncomeRow[];
  sources: string[];
  series: { month: string; incomeCents: number; expenseCents: number }[];
  recurringRules: {
    id: string;
    kind: "ausgabe" | "einnahme";
    amountCents: number;
    interval: IntervalId;
    nextDate: string;
    label: string;
  }[];
};

export function IncomeView({ data }: { data: IncomePageData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const sources = useMemo(
    () => [...new Set([...DEFAULT_INCOME_SOURCES, ...data.sources])].sort((a, b) => a.localeCompare(b, "de")),
    [data.sources],
  );
  const monthTotal = data.monthRows.reduce((a, r) => a + r.amountCents, 0);
  const yearTotal = data.yearRows.reduce((a, r) => a + r.amountCents, 0);

  async function remove(row: IncomeRow) {
    const res = await deleteIncomes([row.id]);
    if (!res.ok) return toast.danger(res.error);
    const id = toast("Einnahme gelöscht", {
      description: `${row.source} · ${formatCents(row.amountCents)}`,
      timeout: 8000,
      actionProps: {
        children: "Rückgängig",
        variant: "tertiary",
        onPress: async () => {
          toast.close(id);
          const r = await restoreIncomes(res.data);
          if (r.ok) router.refresh();
        },
      },
    });
    router.refresh();
  }

  const addButton = (
    <Button
      onPress={() => {
        setFormKey((k) => k + 1);
        setOpen(true);
      }}
    >
      <Plus className="size-4" /> Einnahme hinzufügen
    </Button>
  );

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <Tabs defaultSelectedKey="monat" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Ansicht">
              <Tabs.Tab id="monat">
                Monat
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="jahr">
                <Tabs.Separator />
                Jahr {data.year}
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          {addButton}
        </div>

        <Tabs.Panel id="monat" className="flex flex-col gap-4 pt-4 lg:gap-6">
          <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
            <Card className="rounded-3xl p-5 lg:col-span-2">
              <Card.Header>
                <Card.Description>Einnahmen {formatMonth(data.month)}</Card.Description>
                <p className="tabular text-4xl font-semibold tracking-tight text-success">{formatCents(monthTotal)}</p>
              </Card.Header>
              <Card.Content className="gap-1 pt-4">
                {data.monthRows.length === 0 ? (
                  <Empty
                    icon={<Wallet className="size-6" />}
                    title="Noch keine Einnahmen"
                    text="Trage dein Gehalt oder andere Einnahmen ein."
                    className="py-6"
                  />
                ) : (
                  <IncomeList rows={data.monthRows} onDelete={remove} />
                )}
              </Card.Content>
            </Card>
            <Card className="rounded-3xl p-5 lg:col-span-3">
              <Card.Header>
                <Card.Title>Verlauf</Card.Title>
                <Card.Description>Einnahmen der letzten 12 Monate</Card.Description>
              </Card.Header>
              <Card.Content className="pt-3">
                <IncomeBars data={data.series} height={260} />
              </Card.Content>
            </Card>
          </div>
          <RecurringRules rules={data.recurringRules} />
        </Tabs.Panel>

        <Tabs.Panel id="jahr" className="flex flex-col gap-4 pt-4 lg:gap-6">
          <YearView data={data} total={yearTotal} />
        </Tabs.Panel>
      </Tabs>

      <ResponsiveSheet isOpen={open} onOpenChange={setOpen} title="Neue Einnahme" icon={<Wallet className="size-5" />} tone="success">
        <IncomeForm key={formKey} sources={sources} onDone={() => setOpen(false)} />
      </ResponsiveSheet>
    </div>
  );
}

function IncomeList({ rows, onDelete }: { rows: IncomeRow[]; onDelete: (r: IncomeRow) => void }) {
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.id} className="flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2 hover:bg-default/50">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-success/15 text-success" aria-hidden="true">
            {r.recurring ? <Repeat className="size-4" /> : <Wallet className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{r.source}</p>
            <p className="truncate text-xs text-muted">
              {formatDate(r.date)}
              {r.note ? ` · ${r.note}` : ""}
            </p>
          </div>
          <span className="tabular text-sm font-semibold text-success">+{formatCents(r.amountCents)}</span>
          <Button isIconOnly size="sm" variant="ghost" aria-label={`${r.source} löschen`} onPress={() => onDelete(r)}>
            <Trash2 className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function YearView({ data, total }: { data: IncomePageData; total: number }) {
  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.yearRows) m.set(r.source, (m.get(r.source) ?? 0) + r.amountCents);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.yearRows]);
  const months = data.series.filter((s) => s.month.startsWith(String(data.year)));
  return (
    <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
      <Card className="rounded-3xl p-5 lg:col-span-2">
        <Card.Header>
          <Card.Description>Einnahmen {data.year}</Card.Description>
          <p className="tabular text-4xl font-semibold tracking-tight text-success">{formatCents(total)}</p>
          <p className="text-sm text-muted">
            Ø pro Monat: <span className="tabular font-medium text-foreground">{formatCents(Math.round(total / Math.max(1, months.length)))}</span>
          </p>
        </Card.Header>
        <Card.Content className="gap-3 pt-4">
          {bySource.length === 0 && <p className="text-sm text-muted">Noch keine Einnahmen in diesem Jahr.</p>}
          {bySource.map(([source, cents]) => (
            <div key={source} className="flex items-center justify-between gap-3">
              <span className="text-sm">{source}</span>
              <span className="flex items-center gap-2">
                <Chip size="sm" variant="soft">
                  {formatPercent(total ? cents / total : 0)}
                </Chip>
                <span className="tabular text-sm font-semibold">{formatCents(cents)}</span>
              </span>
            </div>
          ))}
        </Card.Content>
      </Card>
      <Card className="rounded-3xl p-5 lg:col-span-3">
        <Card.Header className="flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <Card.Title>Einnahmen vs. Ausgaben</Card.Title>
            <Card.Description>{data.year}</Card.Description>
          </div>
          <ChartLegend
            items={[
              { label: "Einnahmen", color: "var(--income)" },
              { label: "Ausgaben", color: "var(--expense)" },
            ]}
          />
        </Card.Header>
        <Card.Content className="pt-3">
          <IncomeExpenseBars data={months} />
        </Card.Content>
      </Card>
    </div>
  );
}

function RecurringRules({ rules }: { rules: IncomePageData["recurringRules"] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (rules.length === 0) return null;
  return (
    <Card className="rounded-3xl p-5">
      <Card.Header>
        <Card.Title>Wiederkehrende Buchungen</Card.Title>
        <Card.Description>Werden am Fälligkeitstag automatisch gebucht.</Card.Description>
      </Card.Header>
      <Card.Content className="pt-3">
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-surface-secondary px-3 py-2.5">
              <Repeat className={`size-4 shrink-0 ${r.kind === "einnahme" ? "text-success" : "text-[var(--expense)]"}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted">
                  {labelOf(INTERVALS, r.interval)} · nächste: {formatDate(r.nextDate)}
                </p>
              </div>
              <span className={`tabular text-sm font-semibold ${r.kind === "einnahme" ? "text-success" : ""}`}>
                {r.kind === "einnahme" ? "+" : "−"}
                {formatCents(r.amountCents)}
              </span>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={`${r.label} beenden`}
                isDisabled={pending}
                onPress={() =>
                  start(async () => {
                    const res = await stopRecurringRule(r.id);
                    if (res.ok) {
                      toast.success("Wiederholung beendet");
                      router.refresh();
                    } else toast.danger(res.error);
                  })
                }
              >
                <Square className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  );
}

function IncomeForm({ sources, onDone }: { sources: string[]; onDone: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState<number | null>(null);
  const [source, setSource] = useState("Gehalt");
  const [date, setDate] = useState<string | null>(todayIso());
  const [note, setNote] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [interval, setInterval] = useState<IntervalId | null>("monatlich");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const quickSources = sources.slice(0, 8);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      clientId: crypto.randomUUID(),
      amountCents: amount ? eurosToCents(amount) : 0,
      source: source.trim(),
      date: date ?? "",
      note,
      recurring,
      interval: recurring ? interval : null,
    };
    start(async () => {
      try {
        const res = await createIncome(payload);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          toast.danger(res.error);
          return;
        }
        toast.success("Einnahme gespeichert", { description: `${payload.source} · ${formatCents(payload.amountCents)}` });
        router.refresh();
        onDone();
      } catch (error) {
        if (isNetworkError(error)) {
          enqueue({ type: "income", payload });
          toast.warning("Offline gespeichert", { description: "Wird synchronisiert, sobald du online bist." });
          onDone();
        } else toast.danger("Speichern fehlgeschlagen");
      }
    });
  }

  return (
    <Form onSubmit={submit} validationErrors={errors} validationBehavior="aria" className="flex flex-col gap-5">
      <MoneyField label="Betrag" name="amountCents" value={amount} onChange={setAmount} autoFocus isRequired size="lg" />
      <div className="flex flex-col gap-2">
        <ComboBox
          name="source"
          aria-label="Quelle"
          allowsCustomValue
          inputValue={source}
          onInputChange={setSource}
          onChange={(k) => k && setSource(String(k))}
          isRequired
          fullWidth
        >
          <Label>Quelle</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Eigene Quelle eintippen …" />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <FieldError />
          <ComboBox.Popover>
            <ListBox>
              {sources.map((s) => (
                <ListBox.Item key={s} id={s} textValue={s}>
                  {s}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        <TagGroup
          aria-label="Schnellwahl Quelle"
          selectionMode="single"
          selectedKeys={quickSources.includes(source) ? new Set([source]) : new Set()}
          onSelectionChange={(keys) => {
            const k = [...(keys as Set<string>)][0];
            if (k) setSource(String(k));
          }}
        >
          <TagGroup.List className="scrollbar-none -mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-0.5">
            {quickSources.map((s) => (
              <Tag key={s} id={s} textValue={s} className="min-h-9 shrink-0">
                {s}
              </Tag>
            ))}
          </TagGroup.List>
        </TagGroup>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <DateInput label="Datum" name="date" value={date} onChange={setDate} isRequired />
        <TextField name="note" value={note} onChange={setNote} maxLength={500}>
          <Label>Notiz</Label>
          <Input placeholder="optional" />
        </TextField>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-4">
        <SwitchRow
          label="Wiederkehrend"
          description="z. B. monatliches Gehalt – wird automatisch gebucht"
          isSelected={recurring}
          onChange={setRecurring}
          name="recurring"
          tone="success"
        />
        {recurring && <IntervalSelect value={interval} onChange={setInterval} isRequired />}
      </div>
      <Button
        type="submit"
        size="lg"
        fullWidth
        isPending={pending}
        className="h-12 rounded-2xl bg-success text-success-foreground data-[hovered=true]:bg-success/90"
      >
        Einnahme speichern
      </Button>
    </Form>
  );
}
