"use client";

import {
  Autocomplete,
  Calendar,
  DateField,
  DatePicker,
  Description,
  FieldError,
  Label,
  ListBox,
  NumberField,
  SearchField,
  Select,
  Switch,
  useFilter,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import type { ReactNode } from "react";
import { CategoryIcon } from "@/components/common/category-icon";
import { INTERVALS, type IntervalId } from "@/lib/finance";
import { EURO_FORMAT } from "@/lib/money";

export interface CategoryOption {
  id: string;
  name: string;
  color: string;
  icon: string;
}

/* ── Betrag in Euro ─────────────────────────────────────────────────────── */

export function MoneyField({
  label,
  name,
  value,
  onChange,
  autoFocus,
  isRequired,
  description,
  size = "md",
  minValue = 0,
  className,
}: {
  label: string;
  name: string;
  value: number | null;
  onChange: (euros: number | null) => void;
  autoFocus?: boolean;
  isRequired?: boolean;
  description?: ReactNode;
  size?: "md" | "lg";
  minValue?: number;
  className?: string;
}) {
  return (
    <NumberField
      name={name}
      value={value ?? Number.NaN}
      onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
      formatOptions={EURO_FORMAT}
      minValue={minValue}
      step={0.01}
      isRequired={isRequired}
      autoFocus={autoFocus}
      className={className}
      fullWidth
    >
      <Label>{label}</Label>
      <NumberField.Group>
        <NumberField.Input
          inputMode="decimal"
          placeholder="0,00 €"
          className={size === "lg" ? "tabular h-16 text-3xl font-semibold tracking-tight" : "tabular"}
        />
      </NumberField.Group>
      {description && <Description>{description}</Description>}
      <FieldError />
    </NumberField>
  );
}

/* ── Datum (ISO-String rein/raus) ──────────────────────────────────────── */

export function DateInput({
  label,
  name,
  value,
  onChange,
  isRequired,
  description,
}: {
  label: string;
  name: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  isRequired?: boolean;
  description?: ReactNode;
}) {
  return (
    <DatePicker
      name={name}
      value={value ? parseDate(value) : null}
      onChange={(d) => onChange(d ? d.toString() : null)}
      isRequired={isRequired}
      firstDayOfWeek="mon"
      shouldForceLeadingZeros
    >
      <Label>{label}</Label>
      <DateField.Group fullWidth>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {description && <Description>{description}</Description>}
      <FieldError />
      <DatePicker.Popover>
        <Calendar aria-label={label} firstDayOfWeek="mon">
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>
              {({ year }) => <Calendar.YearPickerCell year={year} />}
            </Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}

/* ── Kategorie (Autocomplete mit Farbe & Icon) ──────────────────────────── */

export function CategoryPicker({
  categories,
  value,
  onChange,
  label = "Kategorie",
  name = "categoryId",
  isRequired,
}: {
  categories: CategoryOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  name?: string;
  isRequired?: boolean;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <Autocomplete
      name={name}
      placeholder="Kategorie wählen"
      value={value}
      onChange={(key) => onChange((key as string | null) ?? null)}
      isRequired={isRequired}
      fullWidth
    >
      <Label>{label}</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value>
          {({ defaultChildren, isPlaceholder }) => {
            const c = categories.find((x) => x.id === value);
            if (isPlaceholder || !c) return defaultChildren;
            return (
              <span className="flex items-center gap-2">
                <CategoryIcon icon={c.icon} color={c.color} size="sm" className="size-6 rounded-lg" />
                {c.name}
              </span>
            );
          }}
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <FieldError />
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus aria-label="Kategorie suchen" name="kategorie-suche" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Suchen …" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox items={categories} renderEmptyState={() => <p className="p-3 text-sm text-muted">Keine Treffer</p>}>
            {(c) => (
              <ListBox.Item id={c.id} textValue={c.name}>
                <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                <Label>{c.name}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

/* ── Intervall ───────────────────────────────────────────────────────────── */

export function IntervalSelect({
  value,
  onChange,
  label = "Intervall",
  name = "interval",
  isRequired,
}: {
  value: IntervalId | null;
  onChange: (v: IntervalId) => void;
  label?: string;
  name?: string;
  isRequired?: boolean;
}) {
  return (
    <Select
      name={name}
      placeholder="Intervall wählen"
      value={value}
      onChange={(k) => k && onChange(k as IntervalId)}
      isRequired={isRequired}
      fullWidth
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <FieldError />
      <Select.Popover>
        <ListBox>
          {INTERVALS.map((i) => (
            <ListBox.Item key={i.id} id={i.id} textValue={i.label}>
              {i.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/* ── Schalter-Zeile (Text links, Switch rechts – ganze Zeile antippbar) ─── */

export function SwitchRow({
  label,
  description,
  isSelected,
  onChange,
  name,
  tone = "accent",
}: {
  label: string;
  description?: string;
  isSelected: boolean;
  onChange: (v: boolean) => void;
  name?: string;
  tone?: "accent" | "success";
}) {
  return (
    <Switch
      isSelected={isSelected}
      onChange={onChange}
      name={name}
      className={`w-full ${tone === "success" ? "[--switch-control-bg-checked:var(--success)] [--switch-control-bg-checked-hover:var(--success)]" : ""}`}
    >
      <Switch.Content className="min-h-11 w-full flex-row items-center justify-between gap-4">
        <span className="flex min-w-0 flex-col gap-0.5">
          <Label className="cursor-pointer">{label}</Label>
          {description && <span className="text-xs text-muted">{description}</span>}
        </span>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}
