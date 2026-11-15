"use client";

import { Button, ButtonGroup, Calendar, DatePicker } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { currentMonthKey, formatMonth, shiftMonth } from "@/lib/dates";

/** ◀ Monat ▶ + Kalender zum Springen. Monat steht in ?monat=JJJJ-MM. */
export function MonthSwitcher({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const go = (m: string) => {
    const next = new URLSearchParams(params.toString());
    if (m === currentMonthKey()) next.delete("monat");
    else next.set("monat", m);
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <ButtonGroup variant="secondary" size="md">
        <Button isIconOnly aria-label="Vorheriger Monat" onPress={() => go(shiftMonth(month, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button className="min-w-40 font-semibold tabular" onPress={() => go(currentMonthKey())}>
          <ButtonGroup.Separator />
          {formatMonth(month)}
        </Button>
        <Button isIconOnly aria-label="Nächster Monat" onPress={() => go(shiftMonth(month, 1))}>
          <ButtonGroup.Separator />
          <ChevronRight className="size-4" />
        </Button>
      </ButtonGroup>
      <DatePicker
        aria-label="Zu Monat springen"
        value={parseDate(`${month}-01`)}
        onChange={(d) => d && go(`${d.year}-${String(d.month).padStart(2, "0")}`)}
        firstDayOfWeek="mon"
      >
        <DatePicker.Trigger
          aria-label="Monat im Kalender wählen"
          className="flex size-10 items-center justify-center rounded-xl bg-default text-foreground transition-colors hover:bg-default/80"
        >
          <CalendarDays className="size-4" />
        </DatePicker.Trigger>
        <DatePicker.Popover>
          <Calendar aria-label="Monat wählen" firstDayOfWeek="mon">
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
    </div>
  );
}
