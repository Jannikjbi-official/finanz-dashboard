"use client";

import { Button, ButtonGroup } from "@heroui/react";
import { useRouter } from "next/navigation";
import { currentMonthKey, shiftMonth } from "@/lib/dates";
import { MONTH_NAMES } from "@/lib/money";

export function MonthSwitcher({
  month,
  basePath = "/",
}: {
  month: string;
  basePath?: string;
}) {
  const router = useRouter();
  const [year, monthNumber] = month.split("-").map(Number);

  function go(target: string) {
    router.push(`${basePath}?m=${target}`);
  }

  return (
    <div className="flex items-center gap-2">
      <ButtonGroup variant="flat" size="sm">
        <Button isIconOnly onPress={() => go(shiftMonth(month, -1))} aria-label="Vorheriger Monat">
          &lsaquo;
        </Button>
        <Button className="min-w-[9.5rem] font-medium" onPress={() => go(currentMonthKey())}>
          {MONTH_NAMES[monthNumber - 1]} {year}
        </Button>
        <Button isIconOnly onPress={() => go(shiftMonth(month, 1))} aria-label="Nächster Monat">
          &rsaquo;
        </Button>
      </ButtonGroup>
    </div>
  );
}
