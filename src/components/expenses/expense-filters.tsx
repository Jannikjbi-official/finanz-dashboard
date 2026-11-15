"use client";

import {
  Button,
  DateField,
  DateRangePicker,
  Dropdown,
  Label,
  RangeCalendar,
  SearchField,
  Tag,
  TagGroup,
  Toolbar,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { CreditCard, FilterX } from "lucide-react";
import { CategoryIcon } from "@/components/common/category-icon";
import type { CategoryOption } from "@/components/forms/fields";
import { PAYMENT_METHODS, type PaymentMethodId } from "@/lib/finance";

export interface ExpenseFilterState {
  search: string;
  from: string;
  to: string;
  categories: Set<string>;
  payments: Set<PaymentMethodId>;
}

export function ExpenseFilters({
  value,
  onChange,
  onRangeChange,
  categories,
  onReset,
}: {
  value: ExpenseFilterState;
  onChange: (next: Partial<ExpenseFilterState>) => void;
  onRangeChange: (from: string, to: string) => void;
  categories: CategoryOption[];
  onReset: () => void;
}) {
  const active = value.search || value.categories.size > 0 || value.payments.size > 0;
  return (
    <div className="flex flex-col gap-3">
      <Toolbar aria-label="Filter" className="flex flex-wrap items-end gap-2 bg-transparent p-0">
        <SearchField
          aria-label="Ausgaben durchsuchen"
          value={value.search}
          onChange={(search) => onChange({ search })}
          className="min-w-0 flex-1 basis-56"
          data-app-search
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Suchen (Notiz, Kategorie, Betrag) …" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <DateRangePicker
          aria-label="Zeitraum"
          value={{ start: parseDate(value.from), end: parseDate(value.to) }}
          onChange={(r) => r && onRangeChange(r.start.toString(), r.end.toString())}
          firstDayOfWeek="mon"
          className="min-w-0 flex-1 basis-56 sm:flex-none"
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
            <RangeCalendar aria-label="Zeitraum wählen" firstDayOfWeek="mon">
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

        <Dropdown>
          <Button variant="secondary" aria-label="Nach Zahlungsart filtern">
            <CreditCard className="size-4" />
            {value.payments.size === 0 ? "Zahlungsart" : `Zahlungsart (${value.payments.size})`}
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              aria-label="Zahlungsarten"
              selectionMode="multiple"
              selectedKeys={value.payments}
              onSelectionChange={(keys) =>
                onChange({
                  payments: new Set(keys === "all" ? PAYMENT_METHODS.map((m) => m.id) : ([...keys] as PaymentMethodId[])),
                })
              }
            >
              {PAYMENT_METHODS.map((m) => (
                <Dropdown.Item key={m.id} id={m.id} textValue={m.label}>
                  <Label>{m.label}</Label>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        {active && (
          <Button variant="ghost" onPress={onReset}>
            <FilterX className="size-4" />
            Zurücksetzen
          </Button>
        )}
      </Toolbar>

      <TagGroup
        aria-label="Kategorien filtern"
        selectionMode="multiple"
        selectedKeys={value.categories}
        onSelectionChange={(keys) =>
          onChange({ categories: new Set(keys === "all" ? categories.map((c) => c.id) : ([...keys] as string[])) })
        }
        size="md"
      >
        <TagGroup.List className="scrollbar-none -mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-0.5 lg:flex-wrap lg:overflow-visible">
          {categories.map((c) => (
            <Tag key={c.id} id={c.id} textValue={c.name}>
              <CategoryIcon icon={c.icon} color={c.color} size="sm" className="size-5 rounded-md [&_svg]:size-3" />
              {c.name}
            </Tag>
          ))}
        </TagGroup.List>
      </TagGroup>
    </div>
  );
}
