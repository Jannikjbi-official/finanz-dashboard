"use client";

import {
  AlertDialog,
  Button,
  Card,
  Checkbox,
  Chip,
  Dropdown,
  Label,
  ListBox,
  Pagination,
  Select,
  type Selection,
  type SortDescriptor,
  Spinner,
  Table,
  TableLayout,
  Virtualizer,
  toast,
} from "@heroui/react";
import { MoreHorizontal, Pencil, Plus, Receipt, Repeat, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CategoryIcon } from "@/components/common/category-icon";
import { Empty } from "@/components/common/empty";
import { useQuickAdd } from "@/components/shell/quick-add";
import { formatDate, formatDayHeading } from "@/lib/dates";
import { PAYMENT_METHODS, labelOf } from "@/lib/finance";
import { formatCents } from "@/lib/money";
import { deleteExpenses, fetchExpenses, restoreExpenses } from "@/server/actions";
import type { ExpenseRow } from "@/server/queries";
import { ExpenseFilters, type ExpenseFilterState } from "./expense-filters";

const PAGE_SIZES = [25, 50, 100] as const;
const VIRTUAL_THRESHOLD = 150;

export function ExpensesView({
  initialRows,
  initialFrom,
  initialTo,
}: {
  initialRows: ExpenseRow[];
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { openExpense, categories } = useQuickAdd();
  const [rows, setRows] = useState(initialRows);
  const [loading, startLoading] = useTransition();
  const [filters, setFilters] = useState<ExpenseFilterState>({
    search: "",
    from: initialFrom,
    to: initialTo,
    categories: new Set(),
    payments: new Set(),
  });

  // Neue Server-Daten (z. B. nach dem Speichern) übernehmen
  useEffect(() => setRows(initialRows), [initialRows]);

  // „/“ aus einer anderen Seite → Suche fokussieren
  useEffect(() => {
    if (params.get("suche") === "1") {
      document.querySelector<HTMLInputElement>("[data-app-search] input")?.focus();
    }
  }, [params]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.categories.size && !(r.categoryId && filters.categories.has(r.categoryId))) return false;
      if (filters.payments.size && !filters.payments.has(r.paymentMethod)) return false;
      if (q) {
        const cat = r.categoryId ? (catMap.get(r.categoryId)?.name ?? "") : "";
        const hay = `${r.note ?? ""} ${cat} ${formatCents(r.amountCents)} ${formatDate(r.date)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters, catMap]);

  function changeRange(from: string, to: string) {
    setFilters((f) => ({ ...f, from, to }));
    startLoading(async () => {
      const res = await fetchExpenses(from, to);
      if (res.ok) setRows(res.data);
      else toast.danger(res.error);
    });
  }

  /** Löschen mit „Rückgängig“-Toast */
  async function remove(ids: string[]) {
    const res = await deleteExpenses(ids);
    if (!res.ok) return toast.danger(res.error);
    setRows((r) => r.filter((x) => !ids.includes(x.id)));
    const deleted = res.data;
    const total = deleted.reduce((a, d) => a + d.amountCents, 0);
    const id = toast(ids.length === 1 ? "Ausgabe gelöscht" : `${ids.length} Ausgaben gelöscht`, {
      description: formatCents(total),
      timeout: 8000,
      actionProps: {
        children: "Rückgängig",
        variant: "tertiary",
        onPress: async () => {
          toast.close(id);
          const r = await restoreExpenses(deleted);
          if (r.ok) {
            toast.success("Wiederhergestellt");
            router.refresh();
          } else toast.danger(r.error);
        },
      },
    });
    router.refresh();
  }

  const total = filtered.reduce((a, r) => a + r.amountCents, 0);

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <Card className="rounded-3xl p-4 sm:p-5">
        <ExpenseFilters
          value={filters}
          onChange={(next) => setFilters((f) => ({ ...f, ...next }))}
          onRangeChange={changeRange}
          categories={categories}
          onReset={() => setFilters((f) => ({ ...f, search: "", categories: new Set(), payments: new Set() }))}
        />
      </Card>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted" aria-live="polite">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" /> Lädt …
            </span>
          ) : (
            <>
              {filtered.length} {filtered.length === 1 ? "Ausgabe" : "Ausgaben"} ·{" "}
              <span className="tabular font-semibold text-foreground">{formatCents(total)}</span>
            </>
          )}
        </p>
        <Button size="sm" onPress={() => openExpense()} className="hidden lg:inline-flex">
          <Plus className="size-4" /> Neue Ausgabe
        </Button>
      </div>

      {filtered.length === 0 && !loading ? (
        <Card className="rounded-3xl">
          <Empty
            icon={<Receipt className="size-6" />}
            title={rows.length === 0 ? "Keine Ausgaben im Zeitraum" : "Keine Treffer"}
            text={
              rows.length === 0
                ? "Erfasse deine erste Ausgabe mit dem Plus-Button oder der Taste N."
                : "Passe Suche oder Filter an, um mehr zu sehen."
            }
            action={
              <Button onPress={() => openExpense()}>
                <Plus className="size-4" /> Ausgabe erfassen
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* PC: Tabelle · Handy: Karten (per CSS – hydration-sicher) */}
          <div className="hidden lg:block">
            <ExpenseTable rows={filtered} catMap={catMap} onDelete={remove} loading={loading} />
          </div>
          <div className="lg:hidden">
            <ExpenseCards rows={filtered} catMap={catMap} onDelete={remove} />
          </div>
        </>
      )}
    </div>
  );
}

type CatMap = Map<string, { id: string; name: string; color: string; icon: string }>;

/* ── PC: Tabelle ─────────────────────────────────────────────────────────── */

function ExpenseTable({
  rows,
  catMap,
  onDelete,
  loading,
}: {
  rows: ExpenseRow[];
  catMap: CatMap;
  onDelete: (ids: string[]) => Promise<unknown>;
  loading: boolean;
}) {
  const { openExpense } = useQuickAdd();
  const [sort, setSort] = useState<SortDescriptor>({ column: "date", direction: "descending" });
  const [selected, setSelected] = useState<Selection>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(25);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const sorted = useMemo(() => {
    const dir = sort.direction === "descending" ? -1 : 1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sort.column) {
        case "amount":
          cmp = a.amountCents - b.amountCents;
          break;
        case "category":
          cmp = (catMap.get(a.categoryId ?? "")?.name ?? "").localeCompare(catMap.get(b.categoryId ?? "")?.name ?? "");
          break;
        case "note":
          cmp = (a.note ?? "").localeCompare(b.note ?? "");
          break;
        case "payment":
          cmp = a.paymentMethod.localeCompare(b.paymentMethod);
          break;
        default:
          cmp = a.date.localeCompare(b.date);
      }
      return cmp * dir;
    });
  }, [rows, sort, catMap]);

  useEffect(() => setPage(1), [rows, pageSize, sort]);

  const virtual = pageSize === "all" && sorted.length > VIRTUAL_THRESHOLD;
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = pageSize === "all" ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize);

  const selectedIds = selected === "all" ? rows.map((r) => r.id) : [...selected].map(String);
  const selectedSum = rows.filter((r) => selectedIds.includes(r.id)).reduce((a, r) => a + r.amountCents, 0);
  const pageSum = visible.reduce((a, r) => a + r.amountCents, 0);
  const allSum = rows.reduce((a, r) => a + r.amountCents, 0);

  const sortable = (id: string, label: string, extra?: { align?: "end"; minWidth?: number; width?: number | `${number}fr` }) => (
    <Table.Column
      id={id}
      allowsSorting
      isRowHeader={id === "date"}
      minWidth={extra?.minWidth ?? 110}
      defaultWidth={extra?.width ?? "1fr"}
      className={extra?.align === "end" ? "text-end" : undefined}
    >
      {({ sortDirection }) => (
        <>
          <Table.SortableColumnHeader sortDirection={sortDirection}>{label}</Table.SortableColumnHeader>
          {!virtual && <Table.ColumnResizer />}
        </>
      )}
    </Table.Column>
  );

  const content = (
    <Table.Content
      aria-label="Ausgaben"
      sortDescriptor={sort}
      onSortChange={setSort}
      selectionMode="multiple"
      selectedKeys={selected}
      onSelectionChange={setSelected}
      onRowAction={(key) => {
        const r = rows.find((x) => x.id === key);
        if (r) openExpense({ ...r, note: r.note ?? "" });
      }}
      className={virtual ? "h-[640px] min-w-[760px] overflow-auto" : "min-w-[760px]"}
    >
      <Table.Header className={virtual ? "sticky top-0 z-10 bg-surface-secondary" : undefined}>
        <Table.Column className="w-12 pe-0" minWidth={48} defaultWidth={48}>
          <Checkbox aria-label="Alle auswählen" slot="selection">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Content>
          </Checkbox>
        </Table.Column>
        {sortable("date", "Datum", { minWidth: 120, width: 130 })}
        {sortable("category", "Kategorie", { minWidth: 160 })}
        {sortable("note", "Notiz", { minWidth: 160, width: "2fr" })}
        {sortable("payment", "Zahlungsart", { minWidth: 130 })}
        {sortable("amount", "Betrag", { align: "end", minWidth: 120, width: 140 })}
        <Table.Column id="actions" minWidth={60} defaultWidth={60} aria-label="Aktionen">
          {""}
        </Table.Column>
      </Table.Header>
      <Table.Body items={visible} renderEmptyState={() => <p className="p-6 text-center text-muted">Keine Einträge</p>}>
        {(r) => {
          const c = r.categoryId ? catMap.get(r.categoryId) : undefined;
          return (
            <Table.Row id={r.id} key={r.id}>
              <Table.Cell className="pe-0">
                <Checkbox aria-label={`Ausgabe vom ${formatDate(r.date)} auswählen`} slot="selection" variant="secondary">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
              </Table.Cell>
              <Table.Cell className="tabular">{formatDate(r.date)}</Table.Cell>
              <Table.Cell>
                <span className="flex items-center gap-2">
                  {c ? <CategoryIcon icon={c.icon} color={c.color} size="sm" /> : null}
                  <span className="truncate">{c?.name ?? "Ohne Kategorie"}</span>
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="flex items-center gap-2 truncate">
                  {r.recurring && <Repeat className="size-3.5 shrink-0 text-muted" aria-label="Wiederkehrend" />}
                  <span className="truncate">{r.note ?? "–"}</span>
                </span>
              </Table.Cell>
              <Table.Cell>
                <Chip size="sm" variant="soft">
                  {labelOf(PAYMENT_METHODS, r.paymentMethod)}
                </Chip>
              </Table.Cell>
              <Table.Cell className="tabular text-end font-semibold">−{formatCents(r.amountCents)}</Table.Cell>
              <Table.Cell>
                <RowMenu
                  onEdit={() => openExpense({ ...r, note: r.note ?? "" })}
                  onDelete={() => void onDelete([r.id])}
                />
              </Table.Cell>
            </Table.Row>
          );
        }}
      </Table.Body>
    </Table.Content>
  );

  return (
    <Card className="overflow-hidden rounded-3xl p-0" aria-busy={loading}>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator bg-accent/8 px-5 py-3">
          <p className="text-sm">
            <span className="font-semibold">{selectedIds.length}</span> ausgewählt ·{" "}
            <span className="tabular font-semibold">{formatCents(selectedSum)}</span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onPress={() => setSelected(new Set())}>
              Auswahl aufheben
            </Button>
            <Button size="sm" variant="danger-soft" onPress={() => setConfirmOpen(true)}>
              <Trash2 className="size-4" /> Löschen
            </Button>
          </div>
        </div>
      )}

      <Table variant="secondary" className="rounded-none">
        {virtual ? (
          <Virtualizer layout={TableLayout} layoutOptions={{ headingHeight: 44, rowHeight: 52 }}>
            <Table.ScrollContainer>{content}</Table.ScrollContainer>
          </Virtualizer>
        ) : (
          <Table.ResizableContainer>{content}</Table.ResizableContainer>
        )}
        <Table.Footer className="flex flex-col gap-3 border-t border-separator px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            {pageSize !== "all" && totalPages > 1 && (
              <span className="text-muted">
                Seite: <span className="tabular font-semibold text-foreground">{formatCents(pageSum)}</span>
              </span>
            )}
            <span className="text-muted">
              Summe: <span className="tabular text-base font-semibold text-foreground">{formatCents(allSum)}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Select
              aria-label="Einträge pro Seite"
              value={String(pageSize)}
              onChange={(k) => setPageSize(k === "all" ? "all" : Number(k))}
              className="w-36"
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {PAGE_SIZES.map((n) => (
                    <ListBox.Item key={n} id={String(n)} textValue={`${n} pro Seite`}>
                      {n} pro Seite
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                  <ListBox.Item id="all" textValue="Alle">
                    Alle
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            {totalPages > 1 && <Pager page={page} total={totalPages} onChange={setPage} />}
          </div>
        </Table.Footer>
      </Table>

      <AlertDialog>
        <AlertDialog.Backdrop isOpen={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[420px]">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  {selectedIds.length} {selectedIds.length === 1 ? "Ausgabe" : "Ausgaben"} löschen?
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  Insgesamt <strong className="tabular">{formatCents(selectedSum)}</strong>. Du kannst das direkt danach
                  noch rückgängig machen.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Abbrechen
                </Button>
                <Button
                  variant="danger"
                  isPending={deleting}
                  onPress={async () => {
                    setDeleting(true);
                    await onDelete(selectedIds);
                    setDeleting(false);
                    setSelected(new Set());
                    setConfirmOpen(false);
                  }}
                >
                  Löschen
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </Card>
  );
}

export function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pages = useMemo(() => {
    const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
    return [...set].sort((a, b) => a - b);
  }, [page, total]);
  return (
    <Pagination aria-label="Seiten">
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page === 1} onPress={() => onChange(page - 1)} aria-label="Vorherige Seite">
            <Pagination.PreviousIcon />
          </Pagination.Previous>
        </Pagination.Item>
        {pages.map((p, i) => (
          <PagerItem key={p} p={p} gap={i > 0 && p - pages[i - 1]! > 1} active={p === page} onChange={onChange} />
        ))}
        <Pagination.Item>
          <Pagination.Next isDisabled={page === total} onPress={() => onChange(page + 1)} aria-label="Nächste Seite">
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

function PagerItem({ p, gap, active, onChange }: { p: number; gap: boolean; active: boolean; onChange: (p: number) => void }) {
  return (
    <>
      {gap && (
        <Pagination.Item>
          <Pagination.Ellipsis />
        </Pagination.Item>
      )}
      <Pagination.Item>
        <Pagination.Link isActive={active} onPress={() => onChange(p)} aria-label={`Seite ${p}`}>
          {p}
        </Pagination.Link>
      </Pagination.Item>
    </>
  );
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <Dropdown>
      <Button isIconOnly size="sm" variant="ghost" aria-label="Aktionen">
        <MoreHorizontal className="size-4" />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label="Aktionen" onAction={(k) => (k === "edit" ? onEdit() : onDelete())}>
          <Dropdown.Item id="edit" textValue="Bearbeiten">
            <Pencil className="size-4 text-muted" />
            <Label>Bearbeiten</Label>
          </Dropdown.Item>
          <Dropdown.Item id="delete" textValue="Löschen" variant="danger">
            <Trash2 className="size-4" />
            <Label>Löschen</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/* ── Handy: Karten nach Tag ──────────────────────────────────────────────── */

function ExpenseCards({
  rows,
  catMap,
  onDelete,
}: {
  rows: ExpenseRow[];
  catMap: CatMap;
  onDelete: (ids: string[]) => Promise<unknown>;
}) {
  const { openExpense } = useQuickAdd();
  const [limit, setLimit] = useState(60);
  const groups = useMemo(() => {
    const map = new Map<string, ExpenseRow[]>();
    for (const r of rows.slice(0, limit)) {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
    return [...map.entries()];
  }, [rows, limit]);

  return (
    <div className="flex flex-col gap-5">
      {groups.map(([date, items]) => (
        <section key={date} aria-label={formatDayHeading(date)}>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-sm font-semibold">{formatDayHeading(date)}</h3>
            <span className="tabular text-xs text-muted">
              −{formatCents(items.reduce((a, r) => a + r.amountCents, 0))}
            </span>
          </div>
          <Card className="gap-0 rounded-3xl p-1.5">
            {items.map((r) => {
              const c = r.categoryId ? catMap.get(r.categoryId) : undefined;
              return (
                <div key={r.id} className="flex min-h-14 items-center gap-3 rounded-2xl px-2.5 py-2">
                  <Button
                    variant="ghost"
                    className="h-auto min-w-0 flex-1 justify-start gap-3 px-0 py-0 text-start font-normal data-[hovered=true]:bg-transparent"
                    onPress={() => openExpense({ ...r, note: r.note ?? "" })}
                    aria-label={`Ausgabe ${formatCents(r.amountCents)} bearbeiten`}
                  >
                    {c ? <CategoryIcon icon={c.icon} color={c.color} /> : <CategoryIcon icon="dots" color="#8b8d98" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.note || c?.name || "Ausgabe"}</span>
                      <span className="flex items-center gap-1 truncate text-xs text-muted">
                        {r.recurring && <Repeat className="size-3" aria-hidden="true" />}
                        {c?.name ?? "Ohne Kategorie"} · {labelOf(PAYMENT_METHODS, r.paymentMethod)}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm font-semibold">−{formatCents(r.amountCents)}</span>
                  </Button>
                  <RowMenu onEdit={() => openExpense({ ...r, note: r.note ?? "" })} onDelete={() => void onDelete([r.id])} />
                </div>
              );
            })}
          </Card>
        </section>
      ))}
      {rows.length > limit && (
        <Button variant="secondary" fullWidth onPress={() => setLimit((l) => l + 60)}>
          Weitere laden ({rows.length - limit})
        </Button>
      )}
    </div>
  );
}
