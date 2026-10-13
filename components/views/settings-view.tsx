"use client";

import { DownloadSimple, Plus, UploadSimple } from "@phosphor-icons/react";
import { Button, ToggleButton, ToggleButtonGroup, type Key } from "@heroui/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { SelectInput, TextInput } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { ImportDialog } from "@/components/forms/import-dialog";
import { ImportList } from "@/components/finance/import-list";
import { SecurityPanel } from "@/components/settings/security-panel";
import { SignOutButton } from "@/components/shell/app-shell";
import { PageHeader, Panel } from "@/components/ui/panel";
import { useAction } from "@/lib/client/use-action";
import { useTheme } from "@/lib/client/theme";
import type { Account, Category, ImportInfo, TxType } from "@/lib/domain/types";
import { deleteCategory, saveCategory, saveTimeZone } from "@/lib/server/actions/accounts";

type CategoryRow = Category & { usage: number };

const COLORS = ["#5f9e8f", "#7c9c74", "#b08a5a", "#a39462", "#6f8fa8", "#8a84a8", "#6d9a9a", "#a87a86", "#8f9f78", "#8b8f94"];
const TIME_ZONES = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/London", "Europe/Lisbon", "Europe/Madrid", "America/New_York", "Asia/Dubai", "UTC"];

export function SettingsView({
  user,
  security,
  timeZone,
  categories,
  accounts,
  imports,
  counts,
}: {
  user: { name: string; email: string };
  security: Parameters<typeof SecurityPanel>[0]["overview"];
  timeZone: string;
  categories: CategoryRow[];
  accounts: Account[];
  imports: ImportInfo[];
  counts: { transactions: number; recurring: number; accounts: number };
}) {
  const { theme, setTheme } = useTheme();
  const { run, pending } = useAction();
  const [zone, setZone] = useState(timeZone);
  const [editing, setEditing] = useState<{ category: CategoryRow | null; kind: TxType } | null>(null);
  const [toDelete, setToDelete] = useState<CategoryRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div>
      <PageHeader title="Einstellungen" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SecurityPanel overview={security} />

        <Panel title="Darstellung und Zeit">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Farbschema</span>
              <ToggleButtonGroup
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={new Set<Key>([theme])}
                onSelectionChange={(keys) => setTheme(String([...keys][0]) as "dark" | "light")}
                size="sm"
                aria-label="Farbschema"
                className="w-fit"
              >
                <ToggleButton id="dark">Dunkel</ToggleButton>
                <ToggleButton id="light">Hell</ToggleButton>
              </ToggleButtonGroup>
              <span className="label font-normal">Wird in diesem Browser gespeichert.</span>
            </div>
            <div className="flex items-end gap-2">
              <SelectInput
                label="Zeitzone"
                value={zone}
                onChange={(value) => value && setZone(value)}
                options={(TIME_ZONES.includes(timeZone) ? TIME_ZONES : [timeZone, ...TIME_ZONES]).map((id) => ({ id, label: id.replace("_", " ") }))}
                description="Bestimmt, welcher Tag „heute“ ist – wichtig für Fälligkeiten und Monatswechsel."
                className="flex-1"
              />
              {zone !== timeZone && (
                <Button size="sm" className="mb-6" isPending={pending} onPress={() => run(() => saveTimeZone(zone))}>
                  Speichern
                </Button>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Daten" description={`${counts.accounts} Konten · ${counts.transactions} Buchungen · ${counts.recurring} regelmäßige Zahlungen`} id="import">
          <div className="flex flex-col gap-4">
            <DataRow title="CSV importieren" text="Umsätze aus dem Export deiner Bank übernehmen, mit Vorschau und Dublettenprüfung.">
              <Button size="sm" variant="secondary" onPress={() => setImportOpen(true)} isDisabled={!accounts.some((a) => !a.archived)}>
                <UploadSimple className="size-4" /> Importieren
              </Button>
            </DataRow>
            <ImportList imports={imports} noun={{ one: "Buchung", many: "Buchungen" }} />
            <DataRow title="CSV exportieren" text="Alle Buchungen mit Status, Konto und Kategorie – für Excel oder Numbers.">
              <a href="/api/export" className="inline-flex h-8 items-center gap-2 rounded-[var(--radius)] bg-default px-3 text-sm font-medium hover:bg-default-hover">
                <DownloadSimple className="size-4" /> CSV
              </a>
            </DataRow>
            <DataRow title="Vollständige Sicherung" text="Alle eigenen Daten als JSON, inklusive Konten, Kategorien und regelmäßiger Zahlungen.">
              <a href="/api/export?format=json" className="inline-flex h-8 items-center gap-2 rounded-[var(--radius)] bg-default px-3 text-sm font-medium hover:bg-default-hover">
                <DownloadSimple className="size-4" /> JSON
              </a>
            </DataRow>
          </div>
        </Panel>

        <Panel title="Kategorien" description="Ordnen Buchungen zu. Löschen entfernt die Kategorie nur aus den Buchungen, nicht die Buchungen selbst." className="lg:col-span-2" bodyClassName="grid grid-cols-1 gap-6 p-4 sm:p-5 md:grid-cols-2">
          {(["expense", "income"] as const).map((kind) => (
            <div key={kind}>
              <div className="mb-1 flex items-center justify-between">
                <span className="label">{kind === "expense" ? "Ausgaben" : "Einnahmen"}</span>
                <Button size="sm" variant="ghost" onPress={() => setEditing({ category: null, kind })}>
                  <Plus className="size-3.5" /> Neu
                </Button>
              </div>
              <ul className="rows">
                {categories
                  .filter((c) => c.kind === kind)
                  .map((category) => (
                    <li key={category.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: category.color }} aria-hidden />
                        <span className="truncate">{category.name}</span>
                        <span className="label font-normal">{category.usage}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 font-normal text-muted" onPress={() => setEditing({ category, kind })}>
                          Bearbeiten
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 font-normal text-muted" onPress={() => setToDelete(category)}>
                          Löschen
                        </Button>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </Panel>

        <Panel title="So wird gerechnet" className="lg:col-span-2">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] md:grid-cols-2">
            <Explain term="Kontostand">Anfangssaldo plus alle bezahlten Ausgaben und eingegangenen Einnahmen eines Kontos. Geplantes und Erwartetes zählt nicht.</Explain>
            <Explain term="Aktuell verfügbar">
              Kontostand der Konten, die zum verfügbaren Geld zählen, minus fälliger und bis Monatsende geplanter Zahlungen. Erwartete Einnahmen zählen erst, wenn sie eingegangen sind.
            </Explain>
            <Explain term="Regelmäßige Zahlungen">
              Jeder Termin ist entweder offen oder erledigt. Wird er als bezahlt markiert, entsteht eine Buchung und der nächste Termin rückt nach – so wird nichts doppelt gezählt.
            </Explain>
            <Explain term="Monats- und Jahreswerte">
              Ein Jahresabo über 120 € entspricht 10 € pro Monat. Das ist ein Vergleichswert; abgebucht werden einmal 120 € am Zahlungstermin.
            </Explain>
            <Explain term="Gekündigt und pausiert">Planen keine Zahlungen mehr ein. Ausnahme: Bei gekündigten Verträgen mit Vertragsende wird bis dahin weiter abgebucht.</Explain>
            <Explain term="Transfers">Verschieben Geld zwischen eigenen Konten und zählen weder als Einnahme noch als Ausgabe.</Explain>
          </dl>
        </Panel>

        <Panel title="Zugang" className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-muted">{user.email}</div>
            </div>
            <SignOutButton withLabel />
          </div>
        </Panel>
      </div>

      {editing && (
        <CategoryDialog key={editing.category?.id ?? `new-${editing.kind}`} editing={editing} onClose={() => setEditing(null)} />
      )}

      <ConfirmDialog
        isOpen={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Kategorie „${toDelete?.name ?? ""}“ löschen?`}
        confirmLabel="Löschen"
        pending={pending}
        onConfirm={() => run(() => deleteCategory(toDelete!.id))}
      >
        <p>
          {toDelete?.usage
            ? `${toDelete.usage} Buchungen behalten ihre Daten, stehen danach aber ohne Kategorie da.`
            : "Die Kategorie wird von keiner Buchung verwendet."}
        </p>
      </ConfirmDialog>

      {importOpen && <ImportDialog isOpen={importOpen} onOpenChange={setImportOpen} accounts={accounts} />}
    </div>
  );
}

function DataRow({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        <div className="label font-normal">{text}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Explain({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium">{term}</dt>
      <dd className="mt-0.5 text-muted">{children}</dd>
    </div>
  );
}

function CategoryDialog({ editing, onClose }: { editing: { category: CategoryRow | null; kind: TxType }; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState(editing.category?.name ?? "");
  const [color, setColor] = useState(editing.category?.color ?? COLORS[0]);
  const { run, pending } = useAction();
  return (
    <FormDialog
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title={editing.category ? "Kategorie bearbeiten" : editing.kind === "income" ? "Einnahmen-Kategorie anlegen" : "Ausgaben-Kategorie anlegen"}
      size="sm"
      pending={pending}
      onSubmit={() => run(() => saveCategory({ id: editing.category?.id ?? null, name, kind: editing.kind, color }))}
    >
      <TextInput label="Name" value={name} onChange={setName} isRequired autoFocus maxLength={40} />
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Farbe</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
          {COLORS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={color === value}
              aria-label={value}
              onClick={() => setColor(value)}
              className={`size-7 rounded-[var(--radius)] outline-none ring-offset-2 ring-offset-overlay focus-visible:ring-2 focus-visible:ring-focus ${color === value ? "ring-2 ring-foreground" : ""}`}
              style={{ background: value }}
            />
          ))}
        </div>
      </div>
    </FormDialog>
  );
}
