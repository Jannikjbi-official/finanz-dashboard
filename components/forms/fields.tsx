"use client";

import {
  Calendar,
  DateField,
  DatePicker,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
  type DateValue,
  type Key,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import type { ReactNode } from "react";

/**
 * Formularfelder mit einheitlichem Aufbau: Label ueber dem Feld,
 * Beschreibung/Fehler darunter. Werte sind immer Strings, damit die
 * Server Actions sie selbst validieren koennen.
 */

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  description,
  isRequired,
  autoFocus,
  maxLength,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: ReactNode;
  isRequired?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  type?: "text" | "email" | "password";
}) {
  return (
    <TextField value={value} onChange={onChange} isRequired={isRequired} type={type} autoFocus={autoFocus} fullWidth>
      <Label>{label}</Label>
      <Input placeholder={placeholder} maxLength={maxLength} />
      {description && <Description>{description}</Description>}
      <FieldError />
    </TextField>
  );
}

/** Betrag im deutschen Format ("12,99"). Validiert wird auf dem Server. */
export function MoneyInput({
  label,
  value,
  onChange,
  description,
  isRequired = true,
  autoFocus,
  allowNegative = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: ReactNode;
  isRequired?: boolean;
  autoFocus?: boolean;
  allowNegative?: boolean;
}) {
  const pattern = allowNegative ? /^[-−]?[\d.,\s]*$/ : /^[\d.,\s]*$/;
  return (
    <TextField
      value={value}
      onChange={(next) => pattern.test(next) && onChange(next)}
      isRequired={isRequired}
      autoFocus={autoFocus}
      fullWidth
    >
      <Label>{label}</Label>
      <div className="relative">
        <Input inputMode="decimal" placeholder="0,00" className="pr-8 text-right" autoComplete="off" />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
          €
        </span>
      </div>
      {description && <Description>{description}</Description>}
      <FieldError />
    </TextField>
  );
}

function toDateValue(value: string | null): DateValue | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

/** Datum mit Kalender. Wert als ISO-String ("2026-10-12") oder null. */
export function DateInput({
  label,
  value,
  onChange,
  description,
  isRequired,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  description?: ReactNode;
  isRequired?: boolean;
}) {
  return (
    <DatePicker
      value={toDateValue(value)}
      onChange={(next) => onChange(next ? next.toString() : null)}
      isRequired={isRequired}
      className="w-full"
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
        <Calendar aria-label={label}>
          <Calendar.Header>
            <Calendar.Heading />
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}

export type Option = { id: string; label: string; hint?: string };

export function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder = "Bitte wählen",
  description,
  isRequired,
  className = "",
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: Option[];
  placeholder?: string;
  description?: ReactNode;
  isRequired?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value as Key | null}
      onChange={(key) => onChange(key === null ? null : String(key))}
      placeholder={placeholder}
      isRequired={isRequired}
      fullWidth
      className={className}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      {description && <Description>{description}</Description>}
      <FieldError />
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                <span className="truncate">{option.label}</span>
                {option.hint && <span className="label shrink-0">{option.hint}</span>}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function NoteInput({ label = "Notiz", value, onChange }: { label?: string; value: string; onChange: (value: string) => void }) {
  return (
    <TextField value={value} onChange={onChange} fullWidth>
      <Label>
        {label} <span className="font-normal text-muted">(optional)</span>
      </Label>
      <TextArea rows={2} maxLength={500} />
    </TextField>
  );
}
