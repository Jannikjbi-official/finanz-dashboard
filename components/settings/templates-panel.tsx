"use client";

import { Trash } from "@phosphor-icons/react";
import { Button } from "@heroui/react";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { useAction } from "@/lib/client/use-action";
import type { Account, Category, Template } from "@/lib/domain/types";
import { deleteTemplate } from "@/lib/server/actions/templates";

/** Vorlagen fuer haeufige Buchungen: angelegt im Buchungsdialog, hier nur loeschen. */
export function TemplatesPanel({ templates, categories, accounts }: { templates: Template[]; categories: Category[]; accounts: Account[] }) {
  const { run, pending } = useAction();
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const accountName = new Map(accounts.map((account) => [account.id, account.name]));

  return (
    <Panel
      id="vorlagen"
      title="Vorlagen"
      description="Häufige Buchungen mit einem Klick erfassen. Anlegen im Buchungsdialog mit „Als Vorlage speichern“."
      className="lg:self-start"
      bodyClassName=""
    >
      {templates.length === 0 ? (
        <p className="px-4 py-6 text-[13.5px] text-muted sm:px-5">Noch keine Vorlagen.</p>
      ) : (
        <ul className="rows">
          {templates.map((template) => (
            <li key={template.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px] sm:px-5">
              <span className="min-w-0">
                <span className="block truncate font-medium">{template.title}</span>
                <span className="label block truncate font-normal">
                  {[
                    template.type === "income" ? "Einnahme" : "Ausgabe",
                    template.categoryId ? categoryName.get(template.categoryId) : null,
                    template.accountId ? accountName.get(template.accountId) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {template.amountCents !== null ? (
                  <Money cents={template.type === "income" ? template.amountCents : -template.amountCents} signed tone="plain" />
                ) : (
                  <span className="label font-normal">Betrag offen</span>
                )}
                <Button size="sm" variant="ghost" isIconOnly aria-label={`Vorlage ${template.title} löschen`} isPending={pending} onPress={() => run(() => deleteTemplate(template.id))}>
                  <Trash className="size-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
