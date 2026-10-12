"use client";

import { ArrowsLeftRight, DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { Button, SearchField, Table, ToggleButton, ToggleButtonGroup, type Key, type SortDescriptor } from "@heroui/react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { SelectInput } from "@/components/forms/fields";
import { ImportDialog } from "@/components/forms/import-dialog";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Figures, Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/panel";
import { Status } from "@/components/ui/status";
import { useAction } from "@/lib/client/use-action";
import { isTransfer } from "@/lib/domain/ledger";
import type { Account, Category, Transaction } from "@/lib/domain/types";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { deleteTransaction, setTransactionStatus } from "@/lib/server/actions/transactions";

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
  initialAccount,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  today: string;
  initialAccount: string | null;
}) {
  const { openTransaction } = useQuickAdd();
  const { run, pending } = useAction();
  const currentMonth = today.slice(0, 7);

  const [query, setQuery] = useState("");
  const [month, setMonth] = useState<string>(initialAccount ? "all" : currentMonth);
  const [kind, setKind] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [status, setStatus] = useState<"all" | "pending" | "booked">("all");
  const [accountId, setAccountId] = useState<string>(initialAccount ?? "all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [sort, setSort] = useState<SortDescriptor>({ column: "date", direction: "descending" });
  const [limit, setLimit] = useState(PAGE);
  const [importOpen, setImportOpen] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState<Row | null>(null);

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const allRows = useMemo(() => toRows(transactions), [transactions]);

  const months = useMemo(() => {
    const set = new Set(transactions.map((tx) => tx.date.slice(0, 7)));
    set.add(currentMonth);
    return [...set].sort().reverse();
  }, [transactions, currentMonth]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = allRows.filter((row) => {
      if (month !== "all" && row.date.slice(0, 7) !== month) return false;
      if (kind !== "all" && row.kind !== kind) return false;
      if (status !== "all" && row.tx.status !== status) return false;
      if (accountId === "none" && row.tx.accountId) return false;
      if (accountId !== "all" && accountId !== "none" && row.tx.accountId !== accountId && row.counterAccountId !== accountId) return false;
      if (categoryId === "none" && (row.tx.categoryId || row.kind === "transfer")) return false;
      if (categoryId !== "all" && categoryId !== "none" && row.tx.categoryId !== categoryId) return false;
      if (needle && !`${row.title} ${row.tx.note ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const direction = sort.direction === "ascending" ? 1 : -1;
    return rows.sort((a, b) => {
      if (sort.column === "amount") return (a.signed - b.signed) * direction;
      if (sort.column === "title") return a.title.localeCompare(b.title, "de") * direction;
      return (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)) * direction;
    });
  }, [allRows, month, kind, status, accountId, categoryId, query, sort]);

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

  const visible = filtered.slice(0, limit);
  const filtersActive = query || month !== currentMonth || kind !== "all" || status !== "all" || accountId !== "all" || categoryId !== "all";

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
          <SearchField aria-label="Transaktionen durchsuchen" value={query} onChange={setQuery} className="lg:w-72">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Beschreibung oder Notiz suchen" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set<Key>([kind])}
            onSelectionChange={(keys) => setKind(String([...keys][0] ?? "all") as typeof kind)}
            size="sm"
            aria-label="Art"
          >
            <ToggleButton id="all">Alle</ToggleButton>
            <ToggleButton id="income">Einnahmen</ToggleButton>
            <ToggleButton id="expense">Ausgaben</ToggleButton>
            <ToggleButton id="transfer">Transfers</ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SelectInput
            label="Monat"
            value={month}
            onChange={(value) => setMonth(value ?? currentMonth)}
            options={[{ id: "all", label: "Alle Monate" }, ...months.map((m) => ({ id: m, label: formatMonth(m) }))]}
          />
          <SelectInput
            label="Status"
            value={status}
            onChange={(value) => setStatus((value ?? "all") as typeof status)}
            options={[
              { id: "all", label: "Alle" },
              { id: "pending", label: "Offen (geplant/erwartet)" },
              { id: "booked", label: "Gebucht (bezahlt/eingegangen)" },
            ]}
          />
          <SelectInput
            label="Konto"
            value={accountId}
            onChange={(value) => setAccountId(value ?? "all")}
            options={[
              { id: "all", label: "Alle Konten" },
              ...accounts.map((a) => ({ id: a.id, label: a.name + (a.archived ? " (archiviert)" : "") })),
              ...(transactions.some((tx) => !tx.accountId) ? [{ id: "none", label: "Ohne Konto" }] : []),
            ]}
          />
          <SelectInput
            label="Kategorie"
            value={categoryId}
            onChange={(value) => setCategoryId(value ?? "all")}
            options={[{ id: "all", label: "Alle Kategorien" }, { id: "none", label: "Ohne Kategorie" }, ...categories.map((c) => ({ id: c.id, label: c.name }))]}
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
        <span className="text-muted">
          {filtered.length} {filtered.length === 1 ? "Eintrag" : "Einträge"}
          {totals.open > 0 && ` · ${totals.open} offen (nicht in den Summen)`}
        </span>
      </div>

      <div className="panel md:hidden">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted">{transactions.length === 0 ? "Noch keine Buchungen." : "Keine Buchungen für diese Filter."}</p>
        ) : (
          <ul className="rows">
            {visible.map((row) => {
              const pending = row.tx.status === "pending";
              return (
                <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left outline-none focus-visible:underline"
                    onClick={() => (row.kind === "transfer" ? setTransferToDelete(row) : openTransaction(row.tx.type, row.tx))}
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
                  {pending && (
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
            onRowAction={(key) => {
              const row = filtered.find((r) => r.id === key);
              if (row && row.kind !== "transfer") openTransaction(row.tx.type, row.tx);
              if (row && row.kind === "transfer") setTransferToDelete(row);
            }}
            className="min-w-[640px]"
          >
            <Table.Header>
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
              dependencies={[accountName, categoryById, today]}
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
                    : [category?.name, row.tx.accountId ? accountName.get(row.tx.accountId) : "ohne Konto"].filter(Boolean).join(" · ");
                const pending = row.tx.status === "pending";
                return (
                  <Table.Row id={row.id}>
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
