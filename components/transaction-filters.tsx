"use client";

import { Select, SelectItem } from "@heroui/react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/types";

/**
 * Filter bekommen ihren Zustand als Props vom Server - kein useSearchParams,
 * damit die Seite nicht in Client-Side-Rendering kippt.
 */
export function TransactionFilters({
  categories,
  month,
  type = "all",
  category = "all",
}: {
  categories: Category[];
  month: string;
  type?: string;
  category?: string;
}) {
  const router = useRouter();

  function update(key: "type" | "cat", value: string) {
    const params = new URLSearchParams({ m: month });

    const nextType = key === "type" ? value : type;
    const nextCategory = key === "cat" ? value : category;

    if (nextType && nextType !== "all") params.set("type", nextType);
    if (nextCategory && nextCategory !== "all") params.set("cat", nextCategory);

    router.push(`/transaktionen?${params.toString()}`);
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
      <Select
        aria-label="Typ"
        size="sm"
        variant="bordered"
        className="w-full sm:w-40"
        selectedKeys={[type]}
        onChange={(event) => {
          if (event.target.value) update("type", event.target.value);
        }}
      >
        <SelectItem key="all">Alle Typen</SelectItem>
        <SelectItem key="income">Nur Einnahmen</SelectItem>
        <SelectItem key="expense">Nur Ausgaben</SelectItem>
      </Select>

      <Select
        aria-label="Kategorie"
        size="sm"
        variant="bordered"
        className="w-full sm:w-52"
        selectedKeys={[category]}
        onChange={(event) => {
          if (event.target.value) update("cat", event.target.value);
        }}
      >
        {[
          { id: "all", name: "Alle Kategorien", icon: "" },
          { id: "none", name: "Ohne Kategorie", icon: "" },
          ...categories,
        ].map((entry) => (
          <SelectItem key={entry.id} textValue={entry.name}>
            {entry.icon ? `${entry.icon} ` : ""}
            {entry.name}
          </SelectItem>
        ))}
      </Select>
    </div>
  );
}
