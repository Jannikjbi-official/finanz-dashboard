"use client";

import { Select, SelectItem } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/types";

export function TransactionFilters({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`/transaktionen?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        aria-label="Typ"
        size="sm"
        variant="bordered"
        className="w-40"
        selectedKeys={[params.get("type") ?? "all"]}
        onChange={(event) => update("type", event.target.value)}
      >
        <SelectItem key="all">Alle Typen</SelectItem>
        <SelectItem key="income">Nur Einnahmen</SelectItem>
        <SelectItem key="expense">Nur Ausgaben</SelectItem>
      </Select>

      <Select
        aria-label="Kategorie"
        size="sm"
        variant="bordered"
        className="w-52"
        selectedKeys={[params.get("cat") ?? "all"]}
        onChange={(event) => update("cat", event.target.value)}
      >
        {[
          { id: "all", name: "Alle Kategorien", icon: "" },
          { id: "none", name: "Ohne Kategorie", icon: "" },
          ...categories,
        ].map((category) => (
          <SelectItem key={category.id} textValue={category.name}>
            {category.icon ? `${category.icon} ` : ""}
            {category.name}
          </SelectItem>
        ))}
      </Select>
    </div>
  );
}
