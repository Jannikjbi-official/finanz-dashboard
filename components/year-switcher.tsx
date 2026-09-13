"use client";

import { Button, ButtonGroup } from "@heroui/react";
import { useRouter } from "next/navigation";

export function YearSwitcher({
  year,
  basePath = "/auswertung",
}: {
  year: number;
  basePath?: string;
}) {
  const router = useRouter();
  const thisYear = new Date().getFullYear();

  return (
    <ButtonGroup variant="flat" size="sm">
      <Button isIconOnly onPress={() => router.push(`${basePath}?y=${year - 1}`)} aria-label="Vorheriges Jahr">
        &lsaquo;
      </Button>
      <Button
        className="min-w-[5rem] font-medium"
        onPress={() => router.push(`${basePath}?y=${thisYear}`)}
      >
        {year}
      </Button>
      <Button
        isIconOnly
        isDisabled={year >= thisYear}
        onPress={() => router.push(`${basePath}?y=${year + 1}`)}
        aria-label="Nächstes Jahr"
      >
        &rsaquo;
      </Button>
    </ButtonGroup>
  );
}
