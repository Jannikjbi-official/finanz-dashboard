"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { completePlanned, deletePlanned, savePlanned } from "@/lib/server/actions/planning";
import { formatDayShort, formatWindow } from "@/lib/format";
import { ActionForm, FormError } from "@/ui/action-form";
import { ActionButton } from "@/ui/action-button";
import { Button } from "@/ui/button";
import { AmountInput, Field, Input, Segmented, Select, Textarea } from "@/ui/field";
import { Empty, Note, PageHeader, Pill } from "@/ui/layout";
import { Money } from "@/ui/money";
import { Sheet } from "@/ui/sheet";
import { cx } from "@/ui/cx";
import { centsToInput, type AccountOption, type CategoryOption } from "@/features/shared/types";

export type PlannedView = {
  id: string;
  kind: "income" | "expense";
  title: string;
  amountCents: number;
  dateFrom: string | null;
  dateTo: string | null;
  certainty: "fixed" | "expected";
  status: "open" | "done" | "cancelled";
  categoryId: string | null;
  accountId: string | null;
  note: string | null;
};

type Timing = "day" | "range" | "open";

function timingOf(item: PlannedView | null): Timing {
  if (!item) return "day";
  if (!item.dateFrom && !item.dateTo) return "open";
  if (item.dateFrom && item.dateFrom === item.dateTo) return "day";
  return "range";
}

export function PlannedPage({
  open,
  done,
  categories,
  accounts,
  today,
}: {
  open: PlannedView[];
  done: PlannedView[];
  categories: CategoryOption[];
  accounts: AccountOption[];
  today: string;
}) {
  const [editing, setEditing] = useState<PlannedView | null>(null);
  const [creating, setCreating] = useState<"income" | "expense" | null>(null);
  const [completing, setCompleting] = useState<PlannedView | null>(null);

  const income = open.filter((p) => p.kind === "income");
  const expense = open.filter((p) => p.kind === "expense");

  function list(items: PlannedView[], kind: "income" | "expense") {
    if (items.length === 0) {
      return (
        <Empty title={kind === "income" ? "Keine offenen Einnahmen." : "Keine geplanten Ausgaben."}>
          {kind === "income"
            ? "Erstattungen, Rückzahlungen von Freunden, Steuererstattung, Bonus – auch wenn der Termin noch offen ist."
            : "Größere Einmalausgaben wie Versicherungen, Reparaturen oder Geschenke – damit die Prognose sie kennt."}
        </Empty>
      );
    }
    return (
      <ul className="border-t border-line">
        {items.map((item) => {
          const overdue = (item.kind === "expense" ? (item.dateFrom ?? item.dateTo) : (item.dateTo ?? item.dateFrom)) ?? "9999";
          return (
            <li key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-line py-3 sm:grid-cols-[1fr_11rem_8rem_auto]">
              <button type="button" onClick={() => setEditing(item)} className="min-w-0 text-left">
                <span className="block truncate text-[14px] font-medium hover:underline">{item.title}</span>
                <span className="text-[12px] text-ink-3">
                  {item.certainty === "expected" ? "erwartet" : "steht fest"}
                  {item.note ? ` · ${item.note}` : ""}
                </span>
              </button>
              <span className={cx("hidden text-[13px] sm:block", overdue < today ? "text-warn" : "text-ink-2")}>
                {formatWindow(item.dateFrom, item.dateTo)}
                {!item.dateFrom && !item.dateTo ? <Pill className="ml-2">zählt nicht</Pill> : null}
              </span>
              <Money cents={item.kind === "income" ? item.amountCents : -item.amountCents} tone="flow" className="text-right text-[14px]" />
              <div className="col-span-2 flex gap-1 sm:col-span-1">
                <Button size="sm" onClick={() => setCompleting(item)}>
                  {item.kind === "income" ? "Eingegangen" : "Bezahlt"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <PageHeader
        title="Geplant & erwartet"
        description="Einmalige Ereignisse, die noch kommen. Sie fließen in Prognose, Kalender und Kaufcheck ein."
        actions={
          <>
            <Button onClick={() => setCreating("income")}>Einnahme erwarten</Button>
            <Button variant="primary" onClick={() => setCreating("expense")}>
              <Plus size={15} weight="bold" /> Ausgabe planen
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <section className="card">
          <h2 className="mb-3 text-[15px] font-semibold">Erwartete Einnahmen</h2>
          {list(income, "income")}
        </section>
        <section className="card">
          <h2 className="mb-3 text-[15px] font-semibold">Geplante Ausgaben</h2>
          {list(expense, "expense")}
        </section>

        {done.length > 0 ? (
          <section className="card">
            <h2 className="mb-3 text-[15px] font-semibold text-ink-2">Zuletzt erledigt</h2>
            <ul className="border-t border-line">
              {done.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-[13px] text-ink-3">
                  <span className="truncate">{item.title}</span>
                  <span className="flex items-center gap-3">
                    <span>{item.dateFrom ? formatDayShort(item.dateFrom) : ""}</span>
                    <Money cents={item.kind === "income" ? item.amountCents : -item.amountCents} tone="muted" />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Note>
          Die Prognose rechnet vorsichtig: geplante Ausgaben am frühesten möglichen Tag, erwartete Einnahmen am spätesten. Einträge
          mit offenem Termin zählen gar nicht – sie werden auf der Lage-Seite nur erwähnt.
        </Note>
      </div>

      <PlannedSheet
        key={editing?.id ?? `new-${creating}`}
        open={editing !== null || creating !== null}
        onOpenChange={(value) => {
          if (!value) {
            setEditing(null);
            setCreating(null);
          }
        }}
        item={editing}
        defaultKind={creating ?? "expense"}
        categories={categories}
        accounts={accounts}
        today={today}
      />

      <Sheet
        open={completing !== null}
        onOpenChange={(value) => !value && setCompleting(null)}
        title={completing?.kind === "income" ? "Eingang erfassen" : "Zahlung erfassen"}
        description={completing ? `„${completing.title}“ wird als Buchung übernommen und abgehakt.` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCompleting(null)}>
              Abbrechen
            </Button>
            <Button variant="primary" type="submit" form="complete-planned">
              Übernehmen
            </Button>
          </div>
        }
      >
        {completing ? (
          <ActionForm id="complete-planned" action={completePlanned} onSuccess={() => setCompleting(null)} className="flex flex-col gap-4">
            {({ error }) => (
              <>
                <input type="hidden" name="id" value={completing.id} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tatsächlicher Betrag" htmlFor="pc-amount" hint="Weicht oft etwas ab.">
                    <AmountInput id="pc-amount" name="amount" defaultValue={centsToInput(completing.amountCents)} />
                  </Field>
                  <Field label="Datum" htmlFor="pc-date">
                    <Input id="pc-date" type="date" name="date" defaultValue={today} />
                  </Field>
                </div>
                <Field label="Konto" htmlFor="pc-account">
                  <Select id="pc-account" name="accountId" defaultValue={completing.accountId ?? accounts.find((a) => !a.archived)?.id ?? "none"}>
                    <option value="none">Kein Konto</option>
                    {accounts
                      .filter((a) => !a.archived)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                <FormError error={error} />
              </>
            )}
          </ActionForm>
        ) : null}
      </Sheet>
    </>
  );
}

function PlannedSheet({
  open,
  onOpenChange,
  item,
  defaultKind,
  categories,
  accounts,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PlannedView | null;
  defaultKind: "income" | "expense";
  categories: CategoryOption[];
  accounts: AccountOption[];
  today: string;
}) {
  const [kind, setKind] = useState(item?.kind ?? defaultKind);
  const [timing, setTiming] = useState<Timing>(timingOf(item));
  const formId = item ? `planned-${item.id}` : "planned-new";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Eintrag bearbeiten" : kind === "income" ? "Einnahme erwarten" : "Ausgabe planen"}
      footer={
        <div className="flex items-center justify-between gap-2">
          {item ? (
            <ActionButton action={deletePlanned} fields={{ id: item.id }} variant="ghost" size="md" className="text-neg" onDone={() => onOpenChange(false)}>
              Entfernen
            </ActionButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button variant="primary" type="submit" form={formId}>
              Speichern
            </Button>
          </div>
        </div>
      }
    >
      <ActionForm id={formId} action={savePlanned} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
        {({ error }) => (
          <>
            {item ? <input type="hidden" name="id" value={item.id} /> : null}
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="timing" value={timing} />

            <Segmented
              name="planned-kind"
              value={kind}
              onChange={setKind}
              className="w-full"
              options={[
                { value: "expense", label: "Ausgabe" },
                { value: "income", label: "Einnahme" },
              ]}
            />

            <div className="grid grid-cols-[1fr_9rem] gap-3">
              <Field label="Bezeichnung" htmlFor="pl-title">
                <Input id="pl-title" name="title" required maxLength={80} defaultValue={item?.title} placeholder={kind === "income" ? "z. B. Erstattung Krankenkasse" : "z. B. Kfz-Versicherung"} />
              </Field>
              <Field label="Betrag" htmlFor="pl-amount">
                <AmountInput id="pl-amount" name="amount" required defaultValue={centsToInput(item?.amountCents)} />
              </Field>
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Wann</legend>
              <Segmented
                name="planned-timing"
                size="sm"
                value={timing}
                onChange={setTiming}
                options={[
                  { value: "day", label: "Bestimmter Tag" },
                  { value: "range", label: "Zeitraum" },
                  { value: "open", label: "Termin offen" },
                ]}
              />
              {timing === "day" ? <Input type="date" name="date" aria-label="Datum" defaultValue={item?.dateFrom ?? today} /> : null}
              {timing === "range" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" name="dateFrom" aria-label="Frühestens" defaultValue={item?.dateFrom ?? today} />
                  <Input type="date" name="dateTo" aria-label="Spätestens" defaultValue={item?.dateTo ?? ""} />
                </div>
              ) : null}
              {timing === "open" ? <p className="text-[13px] text-ink-3">Zählt nicht in der Prognose, bis ein Termin feststeht.</p> : null}
            </fieldset>

            <Field label="Wie sicher?" htmlFor="pl-certainty">
              <Select id="pl-certainty" name="certainty" defaultValue={item?.certainty ?? (kind === "income" ? "expected" : "fixed")}>
                <option value="fixed">Steht fest</option>
                <option value="expected">Wird erwartet</option>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kategorie" htmlFor="pl-category">
                <Select id="pl-category" name="categoryId" defaultValue={item?.categoryId ?? "none"} key={kind}>
                  <option value="none">Ohne Kategorie</option>
                  {categories
                    .filter((c) => c.kind === kind)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Konto" htmlFor="pl-account">
                <Select id="pl-account" name="accountId" defaultValue={item?.accountId ?? "none"}>
                  <option value="none">Kein Konto</option>
                  {accounts
                    .filter((a) => !a.archived)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>

            <Field label="Notiz" htmlFor="pl-note" optional>
              <Textarea id="pl-note" name="note" rows={2} maxLength={300} defaultValue={item?.note ?? ""} />
            </Field>

            <FormError error={error} />
          </>
        )}
      </ActionForm>
    </Sheet>
  );
}
