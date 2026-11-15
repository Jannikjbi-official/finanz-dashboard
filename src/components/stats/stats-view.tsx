"use client";

import {
  Card,
  Chip,
  DateField,
  DateRangePicker,
  ProgressCircle,
  RangeCalendar,
  Table,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { endOfMonth, parseDate, startOfMonth, startOfYear } from "@internationalized/date";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { CategoryDonut, SpendTimeline } from "@/components/charts/lazy";
import { CategoryIcon } from "@/components/common/category-icon";
import { formatDate, today } from "@/lib/dates";
import { PAYMENT_METHODS, labelOf } from "@/lib/finance";
import { formatCents, formatChange, formatPercent, relativeChange } from "@/lib/money";
import type { StatsData } from "@/server/queries";

const PRESETS = [
  { id: "30", label: "30 Tage" },
  { id: "monat", label: "Monat" },
  { id: "3m", label: "3 Monate" },
  { id: "jahr", label: "Jahr" },
] as const;

function presetRange(id: string): [string, string] {
  const t = today();
  switch (id) {
    case "monat":
      return [startOfMonth(t).toString(), endOfMonth(t).toString()];
    case "3m":
      return [startOfMonth(t).subtract({ months: 2 }).toString(), endOfMonth(t).toString()];
    case "jahr":
      return [startOfYear(t).toString(), t.toString()];
    default:
      return [t.subtract({ days: 29 }).toString(), t.toString()];
  }
}

export function StatsView({ data }: { data: StatsData }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const activePreset = PRESETS.find((p) => {
    const [f, t] = presetRange(p.id);
    return f === data.from && t === data.to;
  })?.id;

  const go = (from: string, to: string) =>
    start(() => router.push(`${pathname}?von=${from}&bis=${to}`, { scroll: false }));

  const catMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const spendChange = relativeChange(data.spendCents, data.previous.spendCents);
  const incomeChange = relativeChange(data.incomeCents, data.previous.incomeCents);
  const savingsPct = Math.round(Math.max(0, Math.min(1, data.savingsRate)) * 100);

  return (
    <div className="flex flex-col gap-4 lg:gap-6" aria-busy={pending}>
      <Card className="rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <ToggleButtonGroup
            aria-label="Schnellauswahl Zeitraum"
            selectionMode="single"
            selectedKeys={activePreset ? new Set([activePreset]) : new Set()}
            onSelectionChange={(keys) => {
              const k = [...keys][0];
              if (k) go(...presetRange(String(k)));
            }}
            className="w-full overflow-x-auto lg:w-auto"
          >
            {PRESETS.map((p, i) => (
              <ToggleButton key={p.id} id={p.id} className="min-h-11 flex-1 whitespace-nowrap">
                {i > 0 && <ToggleButtonGroup.Separator />}
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <DateRangePicker
            aria-label="Zeitraum"
            value={{ start: parseDate(data.from), end: parseDate(data.to) }}
            onChange={(r) => r && go(r.start.toString(), r.end.toString())}
            firstDayOfWeek="mon"
            className="w-full lg:w-72"
          >
            <DateField.Group fullWidth>
              <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
              <DateRangePicker.RangeSeparator />
              <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
              <DateField.Suffix>
                <DateRangePicker.Trigger>
                  <DateRangePicker.TriggerIndicator />
                </DateRangePicker.Trigger>
              </DateField.Suffix>
            </DateField.Group>
            <DateRangePicker.Popover>
              <RangeCalendar aria-label="Zeitraum wählen" firstDayOfWeek="mon" visibleDuration={{ months: 1 }}>
                <RangeCalendar.Header>
                  <RangeCalendar.YearPickerTrigger>
                    <RangeCalendar.YearPickerTriggerHeading />
                    <RangeCalendar.YearPickerTriggerIndicator />
                  </RangeCalendar.YearPickerTrigger>
                  <RangeCalendar.NavButton slot="previous" />
                  <RangeCalendar.NavButton slot="next" />
                </RangeCalendar.Header>
                <RangeCalendar.Grid>
                  <RangeCalendar.GridHeader>
                    {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                  </RangeCalendar.GridHeader>
                  <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
                </RangeCalendar.Grid>
                <RangeCalendar.YearPickerGrid>
                  <RangeCalendar.YearPickerGridBody>
                    {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
                  </RangeCalendar.YearPickerGridBody>
                </RangeCalendar.YearPickerGrid>
              </RangeCalendar>
            </DateRangePicker.Popover>
          </DateRangePicker>
        </div>
        <p className="mt-3 text-xs text-muted">
          {data.days} Tage · Vergleich mit {formatDate(data.previous.from)} – {formatDate(data.previous.to)}
        </p>
      </Card>

      <Tabs defaultSelectedKey="uebersicht">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Statistik-Ansicht">
            <Tabs.Tab id="uebersicht">
              Übersicht
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="kategorien">
              <Tabs.Separator />
              Kategorien
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="verlauf">
              <Tabs.Separator />
              Verlauf
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="uebersicht" className="grid gap-4 pt-4 lg:grid-cols-3 lg:gap-6">
          <Card className="rounded-3xl p-5">
            <Card.Header>
              <Card.Description>Ausgaben (inkl. Abos)</Card.Description>
              <p className="tabular text-3xl font-semibold tracking-tight">{formatCents(data.spendCents)}</p>
            </Card.Header>
            <Card.Content className="gap-2 pt-3">
              <ChangeChip change={spendChange} goodWhenUp={false} />
              <p className="text-sm text-muted">
                davon Abos: <span className="tabular text-foreground">{formatCents(data.aboCents)}</span>
              </p>
            </Card.Content>
          </Card>
          <Card className="rounded-3xl p-5">
            <Card.Header>
              <Card.Description>Einnahmen</Card.Description>
              <p className="tabular text-3xl font-semibold tracking-tight text-success">{formatCents(data.incomeCents)}</p>
            </Card.Header>
            <Card.Content className="gap-2 pt-3">
              <ChangeChip change={incomeChange} goodWhenUp />
              <p className="text-sm text-muted">
                Differenz:{" "}
                <span className={`tabular ${data.incomeCents - data.spendCents < 0 ? "text-danger" : "text-foreground"}`}>
                  {formatCents(data.incomeCents - data.spendCents)}
                </span>
              </p>
            </Card.Content>
          </Card>
          <Card className="rounded-3xl p-5">
            <Card.Header>
              <Card.Description>Sparquote</Card.Description>
            </Card.Header>
            <Card.Content className="flex-row items-center gap-5 pt-3">
              <ProgressCircle aria-label="Sparquote" value={savingsPct} color={data.savingsRate >= 0.2 ? "success" : data.savingsRate > 0 ? "warning" : "danger"} className="size-24">
                <ProgressCircle.Track className="size-24" viewBox="0 0 36 36" strokeWidth={3}>
                  <ProgressCircle.TrackCircle cx={18} cy={18} r={16} strokeWidth={3} />
                  <ProgressCircle.FillCircle cx={18} cy={18} r={16} strokeWidth={3} />
                </ProgressCircle.Track>
              </ProgressCircle>
              <div>
                <p className="tabular text-3xl font-semibold">{formatPercent(data.savingsRate)}</p>
                <p className="text-sm text-muted">des Einkommens gespart</p>
              </div>
            </Card.Content>
          </Card>
          <Card className="rounded-3xl p-5 lg:col-span-3">
            <Card.Header>
              <Card.Title>Durchschnittliche Ausgaben</Card.Title>
            </Card.Header>
            <Card.Content className="grid grid-cols-3 gap-3 pt-3">
              {[
                ["pro Tag", data.perDayCents],
                ["pro Woche", data.perWeekCents],
                ["pro Monat", data.perMonthCents],
              ].map(([label, cents]) => (
                <div key={label as string} className="rounded-2xl bg-surface-secondary p-4">
                  <p className="text-xs text-muted sm:text-sm">{label}</p>
                  <p className="tabular text-lg font-semibold tracking-tight sm:text-2xl">{formatCents(cents as number)}</p>
                </div>
              ))}
            </Card.Content>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="kategorien" className="grid gap-4 pt-4 lg:grid-cols-5 lg:gap-6">
          <Card className="rounded-3xl p-5 lg:col-span-2">
            <Card.Header>
              <Card.Title>Top-Kategorien</Card.Title>
            </Card.Header>
            <Card.Content className="gap-4 pt-3">
              {data.slices.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">Keine Ausgaben im Zeitraum.</p>
              ) : (
                <>
                  <CategoryDonut data={data.slices} />
                  <ul className="flex flex-col gap-2">
                    {data.slices.map((s) => (
                      <li key={s.name} className="flex items-center gap-3 text-sm">
                        <CategoryIcon icon={s.icon} color={s.color} size="sm" />
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        <Chip size="sm" variant="soft">
                          {formatPercent(data.spendCents ? s.cents / data.spendCents : 0)}
                        </Chip>
                        <span className="tabular w-24 text-end font-medium">{formatCents(s.cents)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card.Content>
          </Card>
          <Card className="overflow-hidden rounded-3xl p-0 lg:col-span-3">
            <Card.Header className="p-5 pb-3">
              <Card.Title>Größte Einzelausgaben</Card.Title>
            </Card.Header>
            <Table variant="secondary" className="rounded-none">
              <Table.ScrollContainer>
                <Table.Content aria-label="Größte Einzelausgaben" className="min-w-[520px]">
                  <Table.Header>
                    <Table.Column isRowHeader>Datum</Table.Column>
                    <Table.Column>Kategorie</Table.Column>
                    <Table.Column>Notiz</Table.Column>
                    <Table.Column className="text-end">Betrag</Table.Column>
                  </Table.Header>
                  <Table.Body
                    items={data.top}
                    renderEmptyState={() => <p className="p-6 text-center text-sm text-muted">Keine Ausgaben</p>}
                  >
                    {(r) => {
                      const c = r.categoryId ? catMap.get(r.categoryId) : undefined;
                      return (
                        <Table.Row id={r.id}>
                          <Table.Cell className="tabular">{formatDate(r.date)}</Table.Cell>
                          <Table.Cell>
                            <span className="flex items-center gap-2">
                              {c && <CategoryIcon icon={c.icon} color={c.color} size="sm" />}
                              {c?.name ?? "–"}
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-muted">
                            {r.note ?? labelOf(PAYMENT_METHODS, r.paymentMethod)}
                          </Table.Cell>
                          <Table.Cell className="tabular text-end font-semibold">{formatCents(r.amountCents)}</Table.Cell>
                        </Table.Row>
                      );
                    }}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="verlauf" className="pt-4">
          <Card className="rounded-3xl p-5">
            <Card.Header>
              <Card.Title>Ausgaben im Verlauf</Card.Title>
              <Card.Description>{data.timelineUnit === "month" ? "pro Monat" : "pro Tag"} · inkl. Abos</Card.Description>
            </Card.Header>
            <Card.Content className="pt-3">
              <SpendTimeline data={data.timeline} unit={data.timelineUnit} height={320} />
            </Card.Content>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function ChangeChip({ change, goodWhenUp }: { change: number | null; goodWhenUp: boolean }) {
  if (change === null) return <Chip size="sm" variant="soft">Kein Vergleich</Chip>;
  const up = change > 0;
  const good = change === 0 ? null : goodWhenUp ? up : !up;
  return (
    <Chip size="sm" variant="soft" color={good === null ? "default" : good ? "success" : "danger"} className="w-fit">
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      <Chip.Label className="tabular">{formatChange(change)} zum Vorzeitraum</Chip.Label>
    </Chip>
  );
}
