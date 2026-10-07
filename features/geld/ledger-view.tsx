"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowsLeftRight, CaretLeft, CaretRight, MagnifyingGlass, Repeat } from "@phosphor-icons/react/dist/ssr";
import { formatDayWithWeekday, formatMoney, formatMonth, formatWindow } from "@/lib/format";
import { addMonths } from "@/lib/domain/calendar";
import { Empty, Swatch } from "@/ui/layout";
import { Money } from "@/ui/money";
import { Select } from "@/ui/field";
import { cx } from "@/ui/cx";
import { TransactionSheet } from "@/features/shared/transaction-sheet";
import type { AccountOption, CategoryOption, TransactionRow } from "@/features/shared/types";

type Filters = {
  monat: string; // "2026-10" | "alle"
  q: string;
  typ: string;
  kategorie: string;
  konto: string;
};

export function LedgerView({
  rows,
  truncated,
  filters,
  categories,
  accounts,
  today,
}: {
  rows: TransactionRow[];
  truncated: boolean;
  filters: Filters;
  categories: CategoryOption[];
  accounts: AccountOption[];
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q);
  const [editing, setEditing] = useState<TransactionRow | null>(null);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  function update(next: Partial<Filters>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "alle-typen") query.delete(key);
      else query.set(key, value);
    }
    startTransition(() => router.replace(`${pathname}?${query.toString()}`, { scroll: false }));
  }

  // Suche mit kurzer Verzoegerung, damit nicht jeder Tastendruck laedt
  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => update({ q: search }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const allMonths = filters.monat === "alle";
  const month = allMonths ? null : filters.monat;

  const totals = rows.reduce(
    (acc, row) => {
      if (row.transferGroupId) return acc;
      if (row.type === "income") acc.income += row.amountCents;
      else acc.expense += row.amountCents;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const byDay = new Map<string, TransactionRow[]>();
  for (const row of rows) byDay.set(row.date, [...(byDay.get(row.date) ?? []), row]);

  const filtered = Boolean(filters.q || filters.typ || filters.kategorie || filters.konto);

  return (
    <>
      <header className="flex flex-col gap-4 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[28px]">Buchungen</h1>
            <p className="mt-1 text-[14px] text-ink-2">
              {allMonths ? "Alle Monate" : formatMonth(month!)}
              {filtered ? " · gefiltert" : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {month ? (
              <>
                <Link
                  aria-label="Vorheriger Monat"
                  href={`?${withParam(params, "monat", addMonths(`${month}-01`, -1).slice(0, 7))}`}
                  className="rounded-sm p-2 text-ink-2 hover:bg-sunken"
                >
                  <CaretLeft size={16} />
                </Link>
                <input
                  type="month"
                  value={month}
                  onChange={(event) => event.target.value && update({ monat: event.target.value })}
                  aria-label="Monat wählen"
                  className="num h-9 rounded-sm border border-line-strong bg-surface px-2 text-[13px]"
                />
                <Link
                  aria-label="Nächster Monat"
                  href={`?${withParam(params, "monat", addMonths(`${month}-01`, 1).slice(0, 7))}`}
                  className="rounded-sm p-2 text-ink-2 hover:bg-sunken"
                >
                  <CaretRight size={16} />
                </Link>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => update({ monat: allMonths ? today.slice(0, 7) : "alle" })}
              className={cx(
                "ml-1 h-9 rounded-sm border px-3 text-[13px]",
                allMonths ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-2 hover:border-ink-3",
              )}
            >
              Alle Monate
            </button>
          </div>
        </div>

        {/* Filterleiste */}
        <div className="grid gap-2 sm:grid-cols-[1fr_9rem_11rem_11rem]">
          <label className="relative">
            <span className="sr-only">Suchen</span>
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Bezeichnung oder Notiz suchen"
              className="h-10 w-full rounded-sm border border-line-strong bg-surface pl-9 pr-3 text-[14px] placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
          </label>
          <Select aria-label="Typ" value={filters.typ || "alle-typen"} onChange={(e) => update({ typ: e.target.value })}>
            <option value="alle-typen">Alle Typen</option>
            <option value="expense">Ausgaben</option>
            <option value="income">Einnahmen</option>
            <option value="transfer">Umbuchungen</option>
          </Select>
          <Select aria-label="Kategorie" value={filters.kategorie || ""} onChange={(e) => update({ kategorie: e.target.value })}>
            <option value="">Alle Kategorien</option>
            <option value="none">Ohne Kategorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Konto" value={filters.konto || ""} onChange={(e) => update({ konto: e.target.value })}>
            <option value="">Alle Konten</option>
            <option value="none">Ohne Konto</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-y border-line py-2.5 text-[13px] text-ink-3">
          <span>
            {rows.length}
            {truncated ? "+" : ""} Buchungen
          </span>
          <span>
            Eingänge <Money cents={totals.income} className="text-pos" />
          </span>
          <span>
            Ausgänge <Money cents={-totals.expense} className="text-ink" />
          </span>
          <span>
            Saldo <Money cents={totals.income - totals.expense} tone="flow" />
          </span>
          {filtered ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                update({ q: "", typ: "", kategorie: "", konto: "" });
              }}
              className="ml-auto text-accent hover:underline"
            >
              Filter zurücksetzen
            </button>
          ) : null}
        </div>
      </header>

      <div className={cx("transition-opacity", pending && "opacity-50")}>
        {rows.length === 0 ? (
          <Empty title={filtered ? "Keine Buchung passt zu diesen Filtern." : "In diesem Zeitraum gibt es keine Buchungen."}>
            {filtered ? "Filter lockern oder den Zeitraum auf „Alle Monate“ stellen." : "Über „Erfassen“ oben rechts legst du eine an – oder importierst eine CSV-Datei aus dem Online-Banking."}
          </Empty>
        ) : (
          <ol>
            {[...byDay.entries()].map(([date, items]) => {
              const daySum = items.reduce(
                (sum, row) => (row.transferGroupId ? sum : sum + (row.type === "income" ? row.amountCents : -row.amountCents)),
                0,
              );
              return (
                <li key={date}>
                  <div className="sticky top-[97px] z-10 flex items-baseline justify-between bg-paper py-2 pt-5 text-[12px] lg:top-[97px]">
                    <span className="font-medium text-ink-2">{formatDayWithWeekday(date)}</span>
                    <span className="num text-ink-3">{formatMoney(daySum, { signed: true })}</span>
                  </div>
                  <ul className="border-t border-line">
                    {items.map((row) => {
                      const category = row.categoryId ? categoryById.get(row.categoryId) : null;
                      const account = row.accountId ? accountById.get(row.accountId) : null;
                      const signed = row.type === "income" ? row.amountCents : -row.amountCents;
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => setEditing(row)}
                            className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 border-b border-line py-3 text-left hover:bg-sunken/60 sm:grid-cols-[1fr_10rem_9rem_8rem]"
                          >
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                {row.transferGroupId ? <ArrowsLeftRight size={14} className="shrink-0 text-ink-3" aria-label="Umbuchung" /> : null}
                                {row.recurringId ? <Repeat size={14} className="shrink-0 text-ink-3" aria-label="Aus Fixkosten" /> : null}
                                <span className="truncate text-[14px]">{row.title}</span>
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                                {row.datePrecision !== "day" ? `${formatWindow(row.date, row.dateEnd)} · ` : ""}
                                {row.note ?? ""}
                                <span className="sm:hidden">
                                  {row.note ? " · " : ""}
                                  {row.transferGroupId ? "Umbuchung" : (category?.name ?? "Ohne Kategorie")}
                                </span>
                              </span>
                            </span>
                            <span className="hidden min-w-0 items-center gap-2 text-[13px] text-ink-2 sm:flex">
                              {row.transferGroupId ? (
                                <span className="text-ink-3">Umbuchung</span>
                              ) : category ? (
                                <>
                                  <Swatch color={category.color} />
                                  <span className="truncate">{category.name}</span>
                                </>
                              ) : (
                                <span className="text-ink-3">Ohne Kategorie</span>
                              )}
                            </span>
                            <span className="hidden truncate text-[13px] text-ink-3 sm:block">{account?.name ?? "–"}</span>
                            <Money cents={signed} tone={row.transferGroupId ? "muted" : "flow"} className="text-right text-[14px]" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
        {truncated ? (
          <p className="mt-4 text-[13px] text-ink-3">Es werden die neuesten 500 Buchungen gezeigt. Grenze den Zeitraum ein, um ältere zu sehen.</p>
        ) : null}
      </div>

      <TransactionSheet
        key={editing?.id ?? "none"}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        transaction={editing}
        categories={categories}
        accounts={accounts}
        today={today}
      />
    </>
  );
}

function withParam(params: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(params.toString());
  next.set(key, value);
  return next.toString();
}
