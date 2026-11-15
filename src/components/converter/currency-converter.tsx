"use client";

import {
  Alert,
  Button,
  Card,
  Label,
  ListBox,
  NumberField,
  SearchField,
  Autocomplete,
  Tag,
  TagGroup,
  useFilter,
} from "@heroui/react";
import { ArrowDownUp, Receipt } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuickAdd } from "@/components/shell/quick-add";
import { formatDate } from "@/lib/dates";
import { eurosToCents } from "@/lib/money";

interface Rates {
  date: string;
  rates: Record<string, number>;
}

const CACHE_KEY = "finanzen-fx-rates";
const PREFS_KEY = "finanzen-fx-prefs";
const QUICK = ["USD", "GBP", "CHF", "PLN", "TRY", "JPY", "CZK", "SEK"];
const POPULAR = ["USD", "EUR", "GBP", "CHF", "PLN", "TRY", "JPY", "CAD", "AUD"];

const currencyNames = new Intl.DisplayNames(["de-DE"], { type: "currency" });

/** Flaggen-Emoji aus dem Ländercode der Währung (EUR → 🇪🇺). */
function flag(code: string): string {
  const cc = code === "EUR" ? "EU" : code.slice(0, 2);
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: value !== 0 && Math.abs(value) < 1 ? 4 : 2,
  }).format(value);
}

function rateText(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumSignificantDigits: 6 }).format(value);
}

export function CurrencyConverter({ serverRates }: { serverRates: Rates | null }) {
  const { openExpense } = useQuickAdd();
  const [rates, setRates] = useState<Rates | null>(serverRates);
  const [offline, setOffline] = useState(false);
  const [amount, setAmount] = useState<number>(100);
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");

  // Kurse lokal merken (offline nutzbar) bzw. bei Serverfehler den letzten Stand laden
  useEffect(() => {
    try {
      if (serverRates) localStorage.setItem(CACHE_KEY, JSON.stringify(serverRates));
      else {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          setRates(JSON.parse(cached) as Rates);
          setOffline(true);
        }
      }
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as { from?: string; to?: string } | null;
      if (prefs?.from) setFrom(prefs.from);
      if (prefs?.to) setTo(prefs.to);
    } catch {}
  }, [serverRates]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ from, to }));
    } catch {}
  }, [from, to]);

  const codes = useMemo(
    () => (rates ? Object.keys(rates.rates).sort((a, b) => a.localeCompare(b)) : []),
    [rates],
  );

  if (!rates) {
    return (
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Kurse gerade nicht verfügbar</Alert.Title>
          <Alert.Description>Bitte später erneut versuchen – es sind noch keine Kurse auf diesem Gerät gespeichert.</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  const r = rates.rates;
  const convert = (value: number, a: string, b: string) => (r[a] && r[b] ? (value / r[a]) * r[b] : 0);
  const result = convert(amount || 0, from, to);
  const unit = convert(1, from, to);
  const inEur = convert(amount || 0, from, "EUR");

  return (
    <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
      <Card className="rounded-3xl p-5 sm:p-6 lg:col-span-3">
        <Card.Content className="gap-5">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <NumberField
                aria-label={`Betrag in ${from}`}
                value={amount}
                onChange={(v) => setAmount(Number.isNaN(v) ? 0 : v)}
                minValue={0}
                formatOptions={{ style: "currency", currency: from, maximumFractionDigits: 2 }}
                fullWidth
              >
                <Label>Betrag</Label>
                <NumberField.Group className="h-16">
                  <NumberField.Input inputMode="decimal" className="tabular h-full text-3xl font-semibold tracking-tight" />
                </NumberField.Group>
              </NumberField>
              <CurrencyPicker label="Von" value={from} codes={codes} onChange={setFrom} />
            </div>

            <TagGroup
              aria-label="Schnellwahl Währung"
              selectionMode="single"
              selectedKeys={QUICK.includes(from) ? new Set([from]) : new Set()}
              onSelectionChange={(keys) => {
                const k = [...(keys as Set<string>)][0];
                if (k) setFrom(String(k));
              }}
            >
              <TagGroup.List className="scrollbar-none -mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-0.5">
                {QUICK.filter((c) => r[c]).map((c) => (
                  <Tag key={c} id={c} textValue={c} className="min-h-9 shrink-0">
                    <span aria-hidden="true">{flag(c)}</span> {c}
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-separator" />
            <Button
              isIconOnly
              variant="secondary"
              aria-label="Währungen tauschen"
              className="size-11 rounded-full"
              onPress={() => {
                setFrom(to);
                setTo(from);
              }}
            >
              <ArrowDownUp className="size-5" />
            </Button>
            <div className="h-px flex-1 bg-separator" />
          </div>

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="flex min-h-16 min-w-0 flex-col justify-center rounded-[var(--field-radius)] bg-accent/10 px-4 py-2" aria-live="polite">
              <p className="text-sm text-muted">Ergebnis</p>
              <p className="tabular truncate text-3xl font-semibold tracking-tight sm:text-4xl">{money(result, to)}</p>
            </div>
            <CurrencyPicker label="Nach" value={to} codes={codes} onChange={setTo} />
          </div>

          <div className="flex flex-col gap-1 text-sm text-muted">
            <p className="tabular">
              1 {from} = {rateText(unit)} {to} · 1 {to} = {rateText(unit ? 1 / unit : 0)} {from}
            </p>
            <p>
              EZB-Referenzkurs vom {formatDate(rates.date)}
              {offline ? " · offline gespeichert" : ""}
            </p>
          </div>

          {from !== "EUR" && inEur > 0 && (
            <Button
              variant="secondary"
              className="w-fit"
              onPress={() =>
                openExpense({
                  amountCents: eurosToCents(inEur),
                  note: `${money(amount, from)} (Kurs ${rateText(convert(1, from, "EUR"))})`,
                })
              }
            >
              <Receipt className="size-4" />
              {money(inEur, "EUR")} als Ausgabe erfassen
            </Button>
          )}
        </Card.Content>
      </Card>

      <Card className="rounded-3xl p-5 lg:col-span-2">
        <Card.Header>
          <Card.Title>
            {money(amount || 0, from)} in anderen Währungen
          </Card.Title>
        </Card.Header>
        <Card.Content className="pt-3">
          <ul className="flex flex-col">
            {POPULAR.filter((c) => c !== from && r[c]).map((c) => (
              <li key={c} className="flex min-h-12 items-center gap-3 border-b border-separator py-2 last:border-0">
                <span className="text-xl" aria-hidden="true">
                  {flag(c)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{c}</span>
                  <span className="block truncate text-xs text-muted">{currencyNames.of(c)}</span>
                </span>
                <span className="tabular font-semibold">{money(convert(amount || 0, from, c), c)}</span>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>
    </div>
  );
}

function CurrencyPicker({
  label,
  value,
  codes,
  onChange,
}: {
  label: string;
  value: string;
  codes: string[];
  onChange: (code: string) => void;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  const items = codes.map((c) => ({ id: c, name: currencyNames.of(c) ?? c }));
  return (
    <Autocomplete
      aria-label={`${label}: Währung`}
      value={value}
      onChange={(k) => k && onChange(String(k))}
      className="w-32"
    >
      <Label>{label}</Label>
      <Autocomplete.Trigger className="h-16 min-h-16 items-center py-0">
        <Autocomplete.Value>
          {() => (
            <span className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true">{flag(value)}</span>
              {value}
            </span>
          )}
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover className="min-w-64">
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus aria-label="Währung suchen" name="waehrung-suche" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="z. B. Dollar, GBP …" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox items={items} className="max-h-72">
            {(c) => (
              <ListBox.Item id={c.id} textValue={`${c.id} ${c.name}`}>
                <span aria-hidden="true">{flag(c.id)}</span>
                <Label>{c.id}</Label>
                <span className="truncate text-xs text-muted">{c.name}</span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
