"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { SelectInput, TextInput } from "@/components/forms/fields";
import { Panel } from "@/components/ui/panel";
import { useAction } from "@/lib/client/use-action";
import type { CategoryRule } from "@/lib/domain/rules";
import type { Category } from "@/lib/domain/types";
import { applyRulesToExisting, countRuleMatches, deleteRule, saveRule } from "@/lib/server/actions/rules";

const KIND_LABEL = { expense: "Ausgaben", income: "Einnahmen", any: "Ein- und Ausgaben" } as const;

/**
 * Regeln fuer die automatische Kategorisierung: greifen beim Import und bei
 * neuen Buchungen ohne Kategorie; auf Wunsch auch fuer vorhandene.
 */
export function RulesPanel({ rules, categories }: { rules: CategoryRule[]; categories: Category[] }) {
  const { run, pending } = useAction();
  const [match, setMatch] = useState("");
  const [kind, setKind] = useState<"expense" | "income" | "any">("expense");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [applicable, setApplicable] = useState<number | null>(null);
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const options = categories.filter((category) => kind === "any" || category.kind === kind);

  useEffect(() => {
    let cancelled = false;
    countRuleMatches().then((count) => !cancelled && setApplicable(count));
    return () => {
      cancelled = true;
    };
  }, [rules]);

  return (
    <Panel
      id="regeln"
      title="Regeln für Kategorien"
      description="Enthält die Bezeichnung oder Notiz einer Buchung den Text, bekommt sie die Kategorie – beim Import und bei neuen Buchungen ohne Kategorie. Die oberste passende Regel gewinnt."
      className="lg:col-span-2"
    >
      <div className="flex flex-col gap-4">
        {rules.length > 0 && (
          <ul className="rows">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                <span className="min-w-0">
                  enthält <span className="font-medium">„{rule.match}“</span> → {categoryName.get(rule.categoryId) ?? "gelöschte Kategorie"}
                  <span className="label ml-2 font-normal">{rule.kind ? KIND_LABEL[rule.kind] : KIND_LABEL.any}</span>
                </span>
                <Button size="sm" variant="ghost" isIconOnly aria-label={`Regel „${rule.match}“ löschen`} onPress={() => run(() => deleteRule(rule.id))}>
                  <Trash className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_180px_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await run(() => saveRule({ match, categoryId: categoryId ?? "", kind: kind === "any" ? null : kind }));
            if (saved) setMatch("");
          }}
        >
          <TextInput label="Text enthält" value={match} onChange={setMatch} placeholder="z. B. Lidl" maxLength={80} />
          <SelectInput
            label="Gilt für"
            value={kind}
            onChange={(value) => {
              setKind((value ?? "expense") as typeof kind);
              setCategoryId(null);
            }}
            options={(Object.keys(KIND_LABEL) as Array<keyof typeof KIND_LABEL>).map((id) => ({ id, label: KIND_LABEL[id] }))}
          />
          <SelectInput label="Kategorie" value={categoryId} onChange={setCategoryId} options={options.map((c) => ({ id: c.id, label: c.name }))} />
          <Button type="submit" isPending={pending} isDisabled={!match.trim() || !categoryId}>
            <Plus className="size-4" /> Regel
          </Button>
        </form>

        {rules.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-separator pt-3 text-[13px]">
            <span className="text-muted">
              {applicable === null ? "…" : applicable === 0 ? "Alle Buchungen ohne Kategorie sind geprüft – keine passt." : `${applicable} vorhandene Buchungen ohne Kategorie passen zu den Regeln.`}
            </span>
            {applicable ? (
              <Button size="sm" variant="secondary" isPending={pending} onPress={() => run(() => applyRulesToExisting())}>
                Jetzt kategorisieren
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </Panel>
  );
}
