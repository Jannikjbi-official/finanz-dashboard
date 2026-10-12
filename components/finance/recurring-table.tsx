"use client";

import { DotsThreeVertical } from "@phosphor-icons/react";
import { Button, Dropdown, Label, Table, type SortDescriptor } from "@heroui/react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DateInput } from "@/components/forms/fields";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Figures, Money } from "@/components/ui/money";
import { Status } from "@/components/ui/status";
import { useAction } from "@/lib/client/use-action";
import { COST_TYPE_LABEL, INTERVAL_UNIT } from "@/lib/domain/labels";
import { cancellationDeadline, monthlyEquivalent, openDues } from "@/lib/domain/recurring";
import type { Recurring, RecurringStatus } from "@/lib/domain/types";
import { formatDate, formatMoney, formatRelativeDays } from "@/lib/format";
import { daysBetween } from "@/lib/domain/calendar";
import { deleteRecurring, setRecurringStatus, settleRecurring } from "@/lib/server/actions/recurring";

type Dialog = { kind: "cancel" | "archive" | "delete" | "pay"; entry: Recurring } | null;

/** Naechster tatsaechlicher Termin unter Beruecksichtigung des Status. */
function nextDueOf(entry: Recurring, today: string) {
  const [next] = openDues(entry, `${Number(today.slice(0, 4)) + 3}-12-31`);
  return next ?? null;
}

function DueCell({ entry, today }: { entry: Recurring; today: string }) {
  const next = nextDueOf(entry, today);
  if (entry.status === "paused") return <Status tone="neutral">Pausiert</Status>;
  if (entry.status === "archived") return <Status tone="neutral">Archiviert</Status>;
  if (!next) return <Status tone="neutral">{entry.status === "cancelled" ? "Keine weitere Zahlung" : "–"}</Status>;
  const days = daysBetween(today, next);
  return (
    <div>
      <div className="whitespace-nowrap">{formatDate(next)}</div>
      {days < 0 ? (
        <Status tone="danger">Überfällig seit {-days} {-days === 1 ? "Tag" : "Tagen"}</Status>
      ) : days <= 7 ? (
        <Status tone="warning">{days === 0 ? "Heute" : formatRelativeDays(days)}</Status>
      ) : (
        <Status tone="neutral">{formatRelativeDays(days)}</Status>
      )}
    </div>
  );
}

function DueInline({ entry, today }: { entry: Recurring; today: string }) {
  const next = nextDueOf(entry, today);
  if (entry.status === "paused") return <Status tone="neutral">Pausiert</Status>;
  if (entry.status === "archived") return <Status tone="neutral">Archiviert</Status>;
  if (!next) return <Status tone="neutral">Keine weitere Zahlung</Status>;
  const days = daysBetween(today, next);
  const tone = days < 0 ? "danger" : days <= 7 ? "warning" : "neutral";
  return (
    <Status tone={tone}>
      {days < 0 ? `Überfällig seit ${formatDate(next)}` : `Nächste Zahlung ${formatDate(next)}`}
    </Status>
  );
}

export function RecurringTable({
  entries,
  today,
  accountName,
  showCostType = false,
  emptyText,
  ariaLabel,
}: {
  entries: Recurring[];
  today: string;
  accountName: Map<string, string>;
  showCostType?: boolean;
  emptyText: string;
  ariaLabel: string;
}) {
  const { openRecurring } = useQuickAdd();
  const { run, pending } = useAction();
  const [sort, setSort] = useState<SortDescriptor>({ column: "monthly", direction: "descending" });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [cancelledOn, setCancelledOn] = useState<string | null>(today);
  const [endDate, setEndDate] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const direction = sort.direction === "ascending" ? 1 : -1;
    return [...entries].sort((a, b) => {
      if (sort.column === "title") return a.title.localeCompare(b.title, "de") * direction;
      if (sort.column === "provider") return (a.provider ?? "").localeCompare(b.provider ?? "", "de") * direction || a.title.localeCompare(b.title, "de");
      if (sort.column === "next") {
        const an = nextDueOf(a, today) ?? "9999";
        const bn = nextDueOf(b, today) ?? "9999";
        return an.localeCompare(bn) * direction;
      }
      return (monthlyEquivalent(a) - monthlyEquivalent(b)) * direction;
    });
  }, [entries, sort, today]);

  const setStatus = (entry: Recurring, status: RecurringStatus) => run(() => setRecurringStatus({ id: entry.id, status }));

  const actionsFor = (entry: Recurring) => {
    const items: Array<{ id: string; label: string; danger?: boolean }> = [{ id: "edit", label: "Bearbeiten" }];
    const next = nextDueOf(entry, today);
    if (next && entry.status !== "paused") items.push({ id: "pay", label: entry.type === "income" ? "Nächsten Termin als eingegangen buchen" : "Nächste Zahlung als bezahlt buchen" });
    if (entry.status === "active") items.push({ id: "pause", label: "Pausieren" });
    if (entry.status === "paused") items.push({ id: "resume", label: "Fortsetzen" });
    if (entry.status === "active" || entry.status === "paused") items.push({ id: "cancel", label: "Als gekündigt markieren …" });
    if (entry.status === "cancelled") items.push({ id: "resume", label: "Wieder aktivieren" });
    if (entry.status !== "archived") items.push({ id: "archive", label: "Archivieren …" });
    if (entry.status === "archived") {
      items.push({ id: "resume", label: "Wiederherstellen" });
      items.push({ id: "delete", label: "Endgültig löschen …", danger: true });
    }
    return items;
  };

  const onAction = (entry: Recurring, key: string) => {
    if (key === "edit") openRecurring(entry);
    if (key === "pause") void setStatus(entry, "paused");
    if (key === "resume") void setStatus(entry, "active");
    if (key === "cancel") {
      setCancelledOn(today);
      setEndDate(entry.endDate);
      setDialog({ kind: "cancel", entry });
    }
    if (key === "archive") setDialog({ kind: "archive", entry });
    if (key === "delete") setDialog({ kind: "delete", entry });
    if (key === "pay") setDialog({ kind: "pay", entry });
  };

  const menu = (entry: Recurring) => (
    <Dropdown>
      <Button size="sm" variant="ghost" isIconOnly aria-label={`Aktionen für ${entry.title}`} className="size-7 min-w-7">
        <DotsThreeVertical weight="bold" className="size-4" />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={(key) => onAction(entry, String(key))}>
          {actionsFor(entry).map((item) => (
            <Dropdown.Item key={item.id} id={item.id} textValue={item.label} variant={item.danger ? "danger" : "default"}>
              <Label>{item.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );

  const metaOf = (entry: Recurring) => {
    const deadline = entry.status === "active" ? cancellationDeadline(entry) : null;
    return [
      showCostType && entry.type === "expense" ? COST_TYPE_LABEL[entry.costType] : null,
      entry.accountId ? accountName.get(entry.accountId) : null,
      entry.status === "cancelled" && entry.endDate ? `läuft bis ${formatDate(entry.endDate)}` : null,
      deadline && deadline >= today ? `kündbar bis ${formatDate(deadline)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const cancelPreview = dialog?.kind === "cancel" && endDate ? openDues({ ...dialog.entry, status: "cancelled", endDate }, endDate) : [];

  return (
    <>
      <div className="panel md:hidden">
        {sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-muted">{emptyText}</p>
        ) : (
          <ul className="rows">
            {sorted.map((entry) => {
              const meta = [entry.provider, metaOf(entry)].filter(Boolean).join(" · ");
              return (
                <li key={entry.id} className="flex items-start gap-2 py-3 pl-4 pr-2">
                  <button type="button" onClick={() => openRecurring(entry)} className="min-w-0 flex-1 text-left outline-none focus-visible:underline">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{entry.title}</span>
                      <span className="shrink-0 whitespace-nowrap">
                        <Money cents={entry.amountCents} tone="plain" /> <span className="text-muted">/ {INTERVAL_UNIT[entry.interval]}</span>
                      </span>
                    </div>
                    {meta && <div className="label truncate font-normal">{meta}</div>}
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <DueInline entry={entry} today={today} />
                      {entry.interval !== "monthly" && (
                        <span className="label font-normal">
                          ≙ <Money cents={monthlyEquivalent(entry)} tone="muted" /> / Monat
                        </span>
                      )}
                    </div>
                  </button>
                  {menu(entry)}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Table className="hidden md:block">
        <Table.ScrollContainer>
          <Table.Content
            aria-label={ariaLabel}
            sortDescriptor={sort}
            onSortChange={setSort}
            onRowAction={(key) => {
              const entry = entries.find((e) => e.id === key);
              if (entry) openRecurring(entry);
            }}
            className="min-w-[720px]"
          >
            <Table.Header>
              <Table.Column id="title" allowsSorting isRowHeader>
                {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Name</Table.SortableColumnHeader>}
              </Table.Column>
              <Table.Column id="provider" allowsSorting className="w-40">
                {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Anbieter</Table.SortableColumnHeader>}
              </Table.Column>
              <Table.Column id="amount" className="w-36 text-right">
                Betrag
              </Table.Column>
              <Table.Column id="monthly" allowsSorting className="w-32 text-right">
                {({ sortDirection }) => (
                  <Table.SortableColumnHeader sortDirection={sortDirection} className="justify-end">
                    pro Monat
                  </Table.SortableColumnHeader>
                )}
              </Table.Column>
              <Table.Column id="next" allowsSorting className="w-40">
                {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Nächste Zahlung</Table.SortableColumnHeader>}
              </Table.Column>
              <Table.Column id="actions" className="w-12">
                <span className="sr-only">Aktionen</span>
              </Table.Column>
            </Table.Header>
            <Table.Body
              items={sorted}
              dependencies={[today, accountName, showCostType]}
              renderEmptyState={() => <div className="py-10 text-center text-muted">{emptyText}</div>}
            >
              {(entry) => {
                const meta = metaOf(entry);
                return (
                  <Table.Row id={entry.id}>
                    <Table.Cell>
                      <div className="font-medium">{entry.title}</div>
                      {meta && <div className="label font-normal">{meta}</div>}
                    </Table.Cell>
                    <Table.Cell className="text-muted">{entry.provider ?? "–"}</Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-right">
                      <Money cents={entry.amountCents} tone="plain" /> <span className="text-muted">/ {INTERVAL_UNIT[entry.interval]}</span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Money cents={monthlyEquivalent(entry)} tone={entry.interval === "monthly" ? "plain" : "muted"} />
                    </Table.Cell>
                    <Table.Cell>
                      <DueCell entry={entry} today={today} />
                    </Table.Cell>
                    <Table.Cell>
                      {menu(entry)}
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <ConfirmDialog
        isOpen={dialog?.kind === "cancel"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`${dialog?.entry.title ?? ""} als gekündigt markieren`}
        confirmLabel="Als gekündigt markieren"
        tone="default"
        pending={pending}
        onConfirm={() => run(() => setRecurringStatus({ id: dialog!.entry.id, status: "cancelled", cancelledOn, endDate }))}
      >
        <p>
          Trage das Vertragsende nur ein, wenn bis dahin noch abgebucht wird. Ohne Vertragsende wird keine weitere Zahlung eingeplant.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DateInput label="Gekündigt am" value={cancelledOn} onChange={setCancelledOn} />
          <DateInput label="Vertragsende (optional)" value={endDate} onChange={setEndDate} />
        </div>
        {endDate && (
          <p className="text-foreground">
            {cancelPreview.length === 0
              ? "Bis zum Vertragsende ist keine Zahlung mehr fällig."
              : `Bis dahin noch ${cancelPreview.length} ${cancelPreview.length === 1 ? "Zahlung" : "Zahlungen"}, zusammen `}
            {cancelPreview.length > 0 && (
              <span className="num">
                <Figures text={formatMoney(cancelPreview.length * dialog!.entry.amountCents)} />
              </span>
            )}
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={dialog?.kind === "archive"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`${dialog?.entry.title ?? ""} archivieren?`}
        confirmLabel="Archivieren"
        tone="default"
        pending={pending}
        onConfirm={() => run(() => setRecurringStatus({ id: dialog!.entry.id, status: "archived" }))}
      >
        <p>Archivierte Einträge planen keine Zahlungen mehr ein und erscheinen nur noch im Archiv. Bisherige Buchungen bleiben erhalten.</p>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={dialog?.kind === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`${dialog?.entry.title ?? ""} endgültig löschen?`}
        confirmLabel="Endgültig löschen"
        pending={pending}
        onConfirm={() => run(() => deleteRecurring(dialog!.entry.id))}
      >
        <p>Der Eintrag wird gelöscht. Bereits gebuchte Zahlungen bleiben in den Transaktionen erhalten.</p>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={dialog?.kind === "pay"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.entry.type === "income" ? "Als eingegangen buchen?" : "Als bezahlt buchen?"}
        confirmLabel="Buchen"
        tone="default"
        pending={pending}
        onConfirm={() => {
          const entry = dialog!.entry;
          const due = nextDueOf(entry, today);
          if (!due) return Promise.resolve(false);
          return run(() => settleRecurring({ id: entry.id, due, mode: "book" }));
        }}
      >
        {dialog && (
          <p>
            {dialog.entry.title}: <Figures text={formatMoney(dialog.entry.amountCents)} /> für den Termin am{" "}
            {formatDate(nextDueOf(dialog.entry, today) ?? today)}
            {dialog.entry.accountId ? ` vom Konto ${accountName.get(dialog.entry.accountId) ?? ""}` : ""}. Danach rückt die nächste Zahlung einen
            Termin weiter.
            {!dialog.entry.accountId && " Diesem Eintrag ist kein Konto zugeordnet – bitte zuerst bearbeiten und ein Konto wählen."}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
