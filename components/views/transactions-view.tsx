"use client";

import { ArrowsLeftRight, CalendarBlank, CheckSquare, DownloadSimple, Trash, UploadSimple } from "@phosphor-icons/react";
import { Button, Checkbox, Dropdown, Label, SearchField, Table, ToggleButton, ToggleButtonGroup, type Key, type Selection, type SortDescriptor } from "@heroui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DateInput, MoneyInput, SelectInput } from "@/components/forms/fields";
import { ImportDialog } from "@/components/forms/import-dialog";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Figures, Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/panel";
import { Status } from "@/components/ui/status";
import { useAction } from "@/lib/client/use-action";
import { isTransfer } from "@/lib/domain/ledger";
import { defaultFilter, filterToParams, matchesFilter, type TransactionFilter } from "@/lib/domain/transaction-filter";
import type { Account, Category, Transaction } from "@/lib/domain/types";
import { formatAmountInput, formatDate, formatMoney, formatMonth } from "@/lib/format";
import { parseAmountToCents } from "@/lib/money";
import { deleteTransaction, deleteTransactions, setTransactionStatus, updateTransactions } from "@/lib/server/actions/transactions";

type Row = {
  id: string;
  date: string;
  title: string;
  /** Vorzeichenbehaftet; Transfers positiv (nur Verschiebung). */
  signed: number;
  kind: "income" | "expense" | "transfer";
  tx: Transaction;
  /** Bei Transfers: Gegenkonto. */
  counterAccountId: string | null;
};

const PAGE = 100;

/** Transfers bestehen aus zwei Buchungen - in der Liste eine Zeile. */
function toRows(transactions: Transaction[]): Row[] {
  const rows: Row[] = [];
  const seenGroups = new Map<string, Row>();
  for (const tx of transactions) {
    if (isTransfer(tx)) {
      const existing = seenGroups.get(tx.transferGroupId!);
      if (existing) {
        // Ausgehende Seite bestimmt das Quellkonto
        if (tx.type === "expense") {
          existing.counterAccountId = existing.tx.accountId;
          existing.tx = tx;
        } else {
          existing.counterAccountId = tx.accountId;
        }
        continue;
      }
      const row: Row = { id: tx.id, date: tx.date, title: tx.title, signed: tx.amountCents, kind: "transfer", tx, counterAccountId: null };
      seenGroups.set(tx.transferGroupId!, row);
      rows.push(row);
      continue;
    }
    rows.push({
      id: tx.id,
      date: tx.date,
      title: tx.title,
      signed: tx.type === "income" ? tx.amountCents : -tx.amountCents,
      kind: tx.type,
      tx,
      counterAccountId: null,
    });
  }
  return rows;
}

export function TransactionsView({
  transactions,
  accounts,
  categories,
  today,
  initialFilter,
  trashCount,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  today: string;
  initialFilter: TransactionFilter;
  /** Eintraege im Papierkorb (fuer den Link). */
  trashCount: number;
}) {
  const { openTransaction } = useQuickAdd();
  const { run, pending } = useAction();
  const router = useRouter();
  const pathname = usePathname();
  const currentMonth = today.slice(0, 7);

  const [filter, setFilter] = useState<TransactionFilter>(initialFilter);
  const [minText, setMinText] = useState(initialFilter.min !== null ? formatAmountInput(initialFilter.min) : "");
  const [maxText, setMaxText] = useState(initialFilter.max !== null ? formatAmountInput(initialFilter.max) : "");
  const update = (patch: Partial<TransactionFilter>) => setFilter((current) => ({ ...current, ...patch }));
  const { q: query, period: month, kind, status, account: accountId, category: categoryId } = filter;

  // Filter in der Adresse halten (teilbar, "Zurueck" funktioniert); Tippen kurz abwarten
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = filterToParams(filter, currentMonth).toString();
      router.replace(params ? `${pathname}?${params}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [filter, currentMonth, pathname, router]);
  const [sort, setSort] = useState<SortDescriptor>({ column: "date", direction: "descending" });
  const [limit, setLimit] = useState(PAGE);
  const [importOpen, setImportOpen] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState<Row | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  // Auf dem Handy: Antippen waehlt aus statt zu oeffnen
  const [selecting, setSelecting] = useState(false);

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const allRows = useMemo(() => toRows(transactions), [transactions]);

  const months = useMemo(() => {
    const set = new Set(transactions.map((tx) => tx.date.slice(0, 7)));
    set.add(currentMonth);
    return [...set].sort().reverse();
  }, [transactions, currentMonth]);

  const filtered = useMemo(() => {
    const rows = allRows.filter((row) => matchesFilter({ ...row, amountCents: Math.abs(row.signed) }, filter));
    const direction = sort.direction === "ascending" ? 1 : -1;
    return rows.sort((a, b) => {
      if (sort.column === "amount") return (a.signed - b.signed) * direction;
      if (sort.column === "title") return a.title.localeCompare(b.title, "de") * direction;
      return (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)) * direction;
    });
  }, [allRows, filter, sort]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let open = 0;
    for (const row of filtered) {
      if (row.kind === "transfer") continue;
      if (row.tx.status === "pending") {
        open += 1;
        continue;
      }
      if (row.kind === "income") income += row.tx.amountCents;
      else expense += row.tx.amountCents;
    }
    return { income, expense, open };
  }, [filtered]);

  // Monatssummen, sobald die Treffer mehrere Monate umfassen
  const byMonth = useMemo(() => {
    const groups = new Map<string, { income: number; expense: number; count: number }>();
    for (const row of filtered) {
      const key = row.date.slice(0, 7);
      const group = groups.get(key) ?? { income: 0, expense: 0, count: 0 };
      group.count += 1;
      if (row.kind !== "transfer" && row.tx.status === "booked") {
        if (row.kind === "income") group.income += row.tx.amountCents;
        else group.expense += row.tx.amountCents;
      }
      groups.set(key, group);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const visible = filtered.slice(0, limit);
  const filtersActive = filterToParams(filter, currentMonth).toString() !== "";

  // Ausgewaehlt zaehlt nur, was die Filter gerade zeigen
  const selectedRows = useMemo(() => filtered.filter((row) => selection.has(row.id)), [filtered, selection]);
  const selectedIds = selectedRows.map((row) => row.id);
  const toggle = (id: string) =>
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const onTableSelection = (keys: Selection) => setSelection(keys === "all" ? new Set(visible.map((row) => row.id)) : new Set([...keys].map(String)));
  const clearSelection = () => {
    setSelection(new Set());
    setSelecting(false);
  };
  const bulk = async (action: () => ReturnType<typeof updateTransactions>) => {
    if (await run(action)) clearSelection();
  };

  return (
    <div>
      <PageHeader
        title="Transaktionen"
        description="Alle Einnahmen, Ausgaben und Transfers"
        actions={
          <>
            <Button size="sm" variant="ghost" onPress={() => setImportOpen(true)}>
              <UploadSimple className="size-4" /> CSV-Import
            </Button>
            <Link
              href={`/kalender${month !== "all" && month !== "range" ? `?monat=${month}` : ""}`}
              className="inline-flex h-8 items-center gap-2 rounded-[var(--radius)] px-3 text-sm font-medium text-foreground hover:bg-default"
            >
              <CalendarBlank className="size-4" /> Kalender
            </Link>
            {trashCount > 0 && (
              <Link
                href="/einstellungen#papierkorb"
                className="inline-flex h-8 items-center gap-2 rounded-[var(--radius)] px-3 text-sm font-medium text-foreground hover:bg-default"
              >
                <Trash className="size-4" /> Papierkorb ({trashCount})
              </Link>
            )}
            <a
              href="/api/export"
              className="inline-flex h-8 items-center gap-2 rounded-[var(--radius)] px-3 text-sm font-medium text-foreground hover:bg-default"
            >
              <DownloadSimple className="size-4" /> CSV-Export
            </a>
            <Button size="sm" variant="secondary" onPress={() => openTransaction("transfer")}>
              <ArrowsLeftRight className="size-4" /> Transfer
            </Button>
            <Button size="sm" variant="secondary" onPress={() => openTransaction("income")}>
              Einnahme
            </Button>
            <Button size="sm" onPress={() => openTransaction("expense")}>
              Ausgabe
            </Button>
          </>
        }
      />

      <div className="panel mb-4 flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <SearchField aria-label="Transaktionen durchsuchen" value={query} onChange={(value) => update({ q: value })} className="lg:w-72">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Beschreibung, Notiz oder Betrag" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set<Key>([kind])}
            onSelectionChange={(keys) => update({ kind: String([...keys][0] ?? "all") as TransactionFilter["kind"] })}
            size="sm"
            aria-label="Art"
          >
            <ToggleButton id="all">Alle</ToggleButton>
            <ToggleButton id="income">Einnahmen</ToggleButton>
            <ToggleButton id="expense">Ausgaben</ToggleButton>
            <ToggleButton id="transfer">Transfers</ToggleButton>
          </ToggleButtonGroup>
          {filtersActive && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setFilter(defaultFilter(currentMonth));
                setMinText("");
                setMaxText("");
              }}
            >
              Filter zurücksetzen
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SelectInput
            label="Zeitraum"
            value={month}
            onChange={(value) => update({ period: value ?? currentMonth })}
            options={[
              { id: "all", label: "Alle Monate" },
              { id: "range", label: "Von – bis …" },
              ...months.map((m) => ({ id: m, label: formatMonth(m) })),
            ]}
          />
          <SelectInput
            label="Status"
            value={status}
            onChange={(value) => update({ status: (value ?? "all") as TransactionFilter["status"] })}
            options={[
              { id: "all", label: "Alle" },
              { id: "pending", label: "Offen (geplant/erwartet)" },
              { id: "booked", label: "Gebucht (bezahlt/eingegangen)" },
            ]}
          />
          <SelectInput
            label="Konto"
            value={accountId}
            onChange={(value) => update({ account: value ?? "all" })}
            options={[
              { id: "all", label: "Alle Konten" },
              ...accounts.map((a) => ({ id: a.id, label: a.name + (a.archived ? " (archiviert)" : "") })),
              ...(transactions.some((tx) => !tx.accountId) ? [{ id: "none", label: "Ohne Konto" }] : []),
            ]}
          />
          <SelectInput
            label="Kategorie"
            value={categoryId}
            onChange={(value) => update({ category: value ?? "all" })}
            options={[{ id: "all", label: "Alle Kategorien" }, { id: "none", label: "Ohne Kategorie" }, ...categories.map((c) => ({ id: c.id, label: c.name }))]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {month === "range" && (
            <>
              <DateInput label="Von" value={filter.from} onChange={(value) => update({ from: value })} />
              <DateInput label="Bis" value={filter.to} onChange={(value) => update({ to: value })} />
            </>
          )}
          <MoneyInput
            label="Betrag ab"
            value={minText}
            isRequired={false}
            onChange={(value) => {
              setMinText(value);
              update({ min: value.trim() ? parseAmountToCents(value) : null });
            }}
          />
          <MoneyInput
            label="Betrag bis"
            value={maxText}
            isRequired={false}
            onChange={(value) => {
              setMaxText(value);
              update({ max: value.trim() ? parseAmountToCents(value) : null });
            }}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-1 text-[13px]">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <span>
            <span className="text-muted">Einnahmen </span>
            <Money cents={totals.income} tone="plain" />
          </span>
          <span>
            <span className="text-muted">Ausgaben </span>
            <Money cents={totals.expense} tone="plain" />
          </span>
          <span>
            <span className="text-muted">Saldo </span>
            <Money cents={totals.income - totals.expense} signed />
          </span>
        </div>
        <span className="flex items-baseline gap-3 text-muted">
          <span>
            {filtered.length} {filtered.length === 1 ? "Eintrag" : "Einträge"}
            {totals.open > 0 && ` · ${totals.open} offen (nicht in den Summen)`}
          </span>
          {filtered.length > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-foreground underline decoration-border underline-offset-4 md:hidden"
              onClick={() => (selecting ? clearSelection() : setSelecting(true))}
            >
              <CheckSquare className="size-4" aria-hidden /> {selecting ? "Fertig" : "Auswählen"}
            </button>
          )}
        </span>
      </div>

      {selectedRows.length > 0 && (
        <BulkBar
          rows={selectedRows}
          total={filtered.length}
          visible={visible.length}
          accounts={accounts}
          categories={categories}
          pending={pending}
          onSelectAll={() => setSelection(new Set(filtered.map((row) => row.id)))}
          onClear={clearSelection}
          onCategory={(categoryId) => bulk(() => updateTransactions({ ids: selectedIds, categoryId }))}
          onAccount={(accountId) => bulk(() => updateTransactions({ ids: selectedIds, accountId }))}
          onBooked={() => bulk(() => updateTransactions({ ids: selectedIds, booked: true }))}
          onDelete={() => bulk(() => deleteTransactions(selectedIds))}
        />
      )}

      {byMonth.length > 1 && (
        <details className="panel mb-3 px-4 py-2.5 text-[13px] sm:px-5">
          <summary className="cursor-pointer text-muted">Summen je Monat ({byMonth.length} Monate)</summary>
          <table className="mt-2 w-full">
            <thead>
              <tr className="label border-b border-separator">
                <th className="py-1.5 text-left font-medium">Monat</th>
                <th className="py-1.5 text-right font-medium">Einnahmen</th>
                <th className="py-1.5 text-right font-medium">Ausgaben</th>
                <th className="py-1.5 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map(([key, group]) => (
                <tr key={key} className="border-b border-separator last:border-0">
                  <td className="py-1.5">
                    <button type="button" className="underline decoration-border underline-offset-4 hover:decoration-foreground" onClick={() => update({ period: key, from: null, to: null })}>
                      {formatMonth(key)}
                    </button>
                    <span className="text-muted"> · {group.count}</span>
                  </td>
                  <td className="py-1.5 text-right"><Money cents={group.income} tone="plain" /></td>
                  <td className="py-1.5 text-right"><Money cents={group.expense} tone="plain" /></td>
                  <td className="py-1.5 text-right"><Money cents={group.income - group.expense} signed /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <div className="panel md:hidden">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted">{transactions.length === 0 ? "Noch keine Buchungen." : "Keine Buchungen für diese Filter."}</p>
        ) : (
          <ul className="rows">
            {visible.map((row) => {
              const pending = row.tx.status === "pending";
              const checked = selection.has(row.id);
              return (
                <li key={row.id} className={`flex items-center gap-3 px-4 py-2.5 ${checked ? "bg-surface-secondary" : ""}`}>
                  {selecting && (
                    <Checkbox isSelected={checked} onChange={() => toggle(row.id)} aria-label={`${row.title} auswählen`}>
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left outline-none focus-visible:underline"
                    aria-pressed={selecting ? checked : undefined}
                    onClick={() =>
                      selecting ? toggle(row.id) : row.kind === "transfer" ? setTransferToDelete(row) : openTransaction(row.tx.type, row.tx)
                    }
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{row.title}</span>
                      {row.kind === "transfer" ? (
                        <span className="num shrink-0 text-muted">
                          <Figures text={formatMoney(row.signed)} />
                        </span>
                      ) : (
                        <Money cents={row.signed} signed tone="plain" className={`shrink-0 ${row.kind === "income" ? "text-success" : ""} ${pending ? "opacity-60" : ""}`} />
                      )}
                    </div>
                    <div className="label flex justify-between gap-3 font-normal">
                      <span className="truncate">
                        {formatDate(row.date)}
                        {row.tx.categoryId && categoryById.get(row.tx.categoryId) ? ` · ${categoryById.get(row.tx.categoryId)!.name}` : ""}
                      </span>
                      <span className="shrink-0">
                        {row.kind === "transfer" ? "Transfer" : pending ? (row.kind === "income" ? "erwartet" : "geplant") : ""}
                      </span>
                    </div>
                  </button>
                  {pending && !selecting && (
                    <Button size="sm" variant="secondary" className="h-7 shrink-0 px-2.5 text-[12.5px]" onPress={() => run(() => setTransactionStatus(row.id, "booked"))}>
                      {row.kind === "income" ? "Eingegangen" : "Bezahlt"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Table className="hidden md:block">
        <Table.ScrollContainer>
          <Table.Content
            aria-label="Transaktionen"
            sortDescriptor={sort}
            onSortChange={setSort}
            selectionMode="multiple"
            selectionBehavior="toggle"
            selectedKeys={new Set(selectedIds)}
            onSelectionChange={onTableSelection}
            onRowAction={(key) => {
              const row = filtered.find((r) => r.id === key);
              if (row && row.kind !== "transfer") openTransaction(row.tx.type, row.tx);
              if (row && row.kind === "transfer") setTransferToDelete(row);
            }}
            className="min-w-[640px]"
          >
            <Table.Header>
              <Table.Column id="select" className="w-10">
                <SelectionBox label="Alle sichtbaren auswählen" />
              </Table.Column>
              <Table.Column id="date" allowsSorting className="w-28">
                {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Datum</Table.SortableColumnHeader>}
              </Table.Column>
              <Table.Column id="title" allowsSorting isRowHeader>
                {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Beschreibung</Table.SortableColumnHeader>}
              </Table.Column>
              <Table.Column id="status" className="w-40">
                Status
              </Table.Column>
              <Table.Column id="amount" allowsSorting className="w-36 text-right">
                {({ sortDirection }) => (
                  <Table.SortableColumnHeader sortDirection={sortDirection} className="justify-end">
                    Betrag
                  </Table.SortableColumnHeader>
                )}
              </Table.Column>
              <Table.Column id="actions" className="w-32">
                <span className="sr-only">Aktionen</span>
              </Table.Column>
            </Table.Header>
            <Table.Body
              items={visible}
              dependencies={[accountName, categoryById, today, selection]}
              renderEmptyState={() => (
                <div className="py-12 text-center text-muted">
                  {transactions.length === 0
                    ? "Noch keine Buchungen. Erfasse deine erste Einnahme oder Ausgabe – oder importiere eine CSV-Datei deiner Bank."
                    : filtersActive
                      ? "Keine Buchungen für diese Filter."
                      : "Keine Buchungen in diesem Monat."}
                </div>
              )}
            >
              {(row) => {
                const category = row.tx.categoryId ? categoryById.get(row.tx.categoryId) : null;
                const meta =
                  row.kind === "transfer"
                    ? `${accountName.get(row.tx.accountId ?? "") ?? "?"} → ${accountName.get(row.counterAccountId ?? "") ?? "?"}`
                    : [category?.name, row.tx.accountId ? accountName.get(row.tx.accountId) : "ohne Konto", row.tx.splitGroupId ? "Teil einer Aufteilung" : null]
                        .filter(Boolean)
                        .join(" · ");
                const pending = row.tx.status === "pending";
                return (
                  <Table.Row id={row.id}>
                    <Table.Cell>
                      <SelectionBox label={`${row.title} auswählen`} />
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-muted">{formatDate(row.date)}</Table.Cell>
                    <Table.Cell>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{row.title}</div>
                        <div className="label truncate font-normal">{meta}</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {row.kind === "transfer" ? (
                        <Status tone="neutral">Transfer</Status>
                      ) : pending ? (
                        row.date < today ? (
                          <Status tone="danger">{row.kind === "income" ? "Ausstehend" : "Überfällig"}</Status>
                        ) : (
                          <Status tone={row.kind === "income" ? "accent" : "warning"}>{row.kind === "income" ? "Erwartet" : "Geplant"}</Status>
                        )
                      ) : (
                        <Status tone="success">{row.kind === "income" ? "Eingegangen" : "Bezahlt"}</Status>
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {row.kind === "transfer" ? (
                        <span className="num text-muted">
                          <Figures text={formatMoney(row.signed)} />
                        </span>
                      ) : (
                        <Money cents={row.signed} signed tone="plain" className={`${row.kind === "income" ? "text-success" : ""} ${pending ? "opacity-60" : ""}`} />
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {pending && (
                        <Button size="sm" variant="secondary" className="h-7 px-2.5 text-[12.5px]" onPress={() => run(() => setTransactionStatus(row.id, "booked"))}>
                          {row.kind === "income" ? "Eingegangen" : "Bezahlt"}
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {filtered.length > limit && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onPress={() => setLimit((value) => value + PAGE)}>
            Weitere {Math.min(PAGE, filtered.length - limit)} anzeigen
          </Button>
        </div>
      )}

      {importOpen && <ImportDialog isOpen={importOpen} onOpenChange={setImportOpen} accounts={accounts} />}

      <ConfirmDialog
        isOpen={transferToDelete !== null}
        onOpenChange={(open) => !open && setTransferToDelete(null)}
        title="Transfer löschen?"
        confirmLabel="Transfer löschen"
        pending={pending}
        onConfirm={() => run(() => deleteTransaction(transferToDelete!.id))}
      >
        {transferToDelete && (
          <p>
            {formatDate(transferToDelete.date)}: <Figures text={formatMoney(transferToDelete.signed)} /> von{" "}
            {accountName.get(transferToDelete.tx.accountId ?? "") ?? "?"} nach {accountName.get(transferToDelete.counterAccountId ?? "") ?? "?"}. Beide
            Buchungen werden entfernt, die Kontostände ändern sich entsprechend. Transfers lassen sich nicht bearbeiten – lege ihn bei Bedarf neu an.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** Kontrollkaestchen der Tabellenauswahl (react-aria verdrahtet es ueber slot). */
function SelectionBox({ label }: { label: string }) {
  return (
    <Checkbox slot="selection" aria-label={label}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

/** Aktionen fuer die Auswahl: Kategorie, Konto, bezahlt, loeschen (in den Papierkorb). */
function BulkBar({
  rows,
  total,
  visible,
  accounts,
  categories,
  pending,
  onSelectAll,
  onClear,
  onCategory,
  onAccount,
  onBooked,
  onDelete,
}: {
  rows: Row[];
  total: number;
  visible: number;
  accounts: Account[];
  categories: Category[];
  pending: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onCategory: (categoryId: string | null) => void;
  onAccount: (accountId: string) => void;
  onBooked: () => void;
  onDelete: () => void;
}) {
  const kinds = new Set(rows.map((row) => row.kind));
  const editable = rows.some((row) => row.kind !== "transfer");
  const open = rows.some((row) => row.kind !== "transfer" && row.tx.status === "pending");
  // Nur Kategorien der ausgewaehlten Art anbieten; gemischt: beide, Server ueberspringt Unpassendes
  const usable = categories.filter((category) => kinds.has(category.kind));
  const sum = rows.reduce((value, row) => (row.kind === "transfer" ? value : value + row.signed), 0);

  return (
    <div className="panel sticky top-[4.25rem] z-20 mb-3 flex flex-col gap-2 px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4" role="region" aria-label="Auswahl">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
        <span className="font-medium">{rows.length} ausgewählt</span>
        {editable && (
          <span className="text-muted">
            Summe <Money cents={sum} signed tone="plain" />
          </span>
        )}
        {rows.length === visible && total > visible && (
          <button type="button" className="underline decoration-border underline-offset-4" onClick={onSelectAll}>
            Alle {total} Treffer auswählen
          </button>
        )}
        <button type="button" className="text-muted underline decoration-border underline-offset-4" onClick={onClear}>
          Aufheben
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {editable && (
          <Dropdown>
            <Button size="sm" variant="secondary" isPending={pending}>
              Kategorie
            </Button>
            <Dropdown.Popover placement="bottom end" className="max-h-80 overflow-auto">
              <Dropdown.Menu aria-label="Kategorie setzen" onAction={(key) => onCategory(key === "none" ? null : String(key))}>
                {[{ id: "none", name: "Ohne Kategorie" }, ...usable].map((category) => (
                  <Dropdown.Item key={category.id} id={category.id} textValue={category.name}>
                    <Label>{category.name}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
        {editable && (
          <Dropdown>
            <Button size="sm" variant="secondary" isPending={pending}>
              Konto
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label="Konto setzen" onAction={(key) => onAccount(String(key))}>
                {accounts
                  .filter((account) => !account.archived)
                  .map((account) => (
                    <Dropdown.Item key={account.id} id={account.id} textValue={account.name}>
                      <Label>{account.name}</Label>
                    </Dropdown.Item>
                  ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
        {open && (
          <Button size="sm" variant="secondary" isPending={pending} onPress={onBooked}>
            Als bezahlt
          </Button>
        )}
        <Button size="sm" variant="danger-soft" isPending={pending} onPress={onDelete}>
          <Trash className="size-4" /> Löschen
        </Button>
      </div>
    </div>
  );
}
