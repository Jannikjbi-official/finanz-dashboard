"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatMonth, formatMonthShort } from "@/lib/dates";
import { formatCents, formatCentsCompact, formatPercent } from "@/lib/money";

/* Gemeinsamer Tooltip im HeroUI-Overlay-Stil */
function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-40 rounded-2xl bg-overlay px-3 py-2.5 text-xs text-overlay-foreground shadow-overlay">
      <p className="mb-1.5 font-medium text-muted">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            {r.color && <span className="size-2.5 rounded-full" style={{ backgroundColor: r.color }} aria-hidden="true" />}
            {r.label}
          </span>
          <span className="tabular font-semibold">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted)", fontSize: 12 },
} as const;

/* ── Donut: Ausgaben nach Kategorie ──────────────────────────────────────── */

export interface DonutSlice {
  name: string;
  color: string;
  cents: number;
}

export function CategoryDonut({ data, centerLabel }: { data: DonutSlice[]; centerLabel?: string }) {
  const total = data.reduce((a, d) => a + d.cents, 0);
  // Mehr als 7 Kategorien → Rest als „Weitere“
  const slices = useMemo(() => {
    if (data.length <= 7) return data;
    const rest = data.slice(6).reduce((a, d) => a + d.cents, 0);
    return [...data.slice(0, 6), { name: "Weitere", color: "var(--muted)", cents: rest }];
  }, [data]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="cents"
            nameKey="name"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            cornerRadius={6}
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive
            animationDuration={700}
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0];
              if (!active || !p) return null;
              const s = p.payload as DonutSlice;
              return (
                <TooltipBox
                  title={s.name}
                  rows={[
                    { label: "Betrag", value: formatCents(s.cents), color: s.color },
                    { label: "Anteil", value: formatPercent(total ? s.cents / total : 0) },
                  ]}
                />
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs text-muted">{centerLabel ?? "Gesamt"}</span>
        <span className="tabular text-xl font-semibold tracking-tight">{formatCents(total)}</span>
      </div>
    </div>
  );
}

/* ── Balken: Einnahmen vs. Ausgaben (12 Monate) ──────────────────────────── */

export interface MonthPoint {
  month: string;
  incomeCents: number;
  expenseCents: number;
}

export function IncomeExpenseBars({ data, height = 260 }: { data: MonthPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey="month" {...axisProps} tickFormatter={(m: string) => formatMonthShort(m)} interval="preserveStartEnd" />
          <YAxis {...axisProps} width={56} tickFormatter={(v: number) => formatCentsCompact(v)} />
          <Tooltip
            cursor={{ fill: "var(--default)", opacity: 0.5, radius: 8 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]!.payload as MonthPoint;
              return (
                <TooltipBox
                  title={formatMonth(String(label))}
                  rows={[
                    { label: "Einnahmen", value: formatCents(p.incomeCents), color: "var(--income)" },
                    { label: "Ausgaben", value: formatCents(p.expenseCents), color: "var(--expense)" },
                    { label: "Differenz", value: formatCents(p.incomeCents - p.expenseCents) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="incomeCents" name="Einnahmen" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expenseCents" name="Ausgaben" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { ChartLegend } from "./legend";

/* ── Linie: Kontostand-Verlauf ───────────────────────────────────────────── */

export function BalanceArea({
  data,
  height = 220,
}: {
  data: { date: string; day: number; cents: number }[];
  height?: number;
}) {
  const values = data.map((d) => d.cents);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(5000, Math.round((hi - lo) * 0.15));
  const min = lo - pad;
  const last = data.at(-1)?.cents ?? 0;
  const color = last >= 0 ? "var(--accent)" : "var(--danger)";
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" tickFormatter={(d: number) => `${d}.`} />
          <YAxis {...axisProps} width={56} tickFormatter={(v: number) => formatCentsCompact(v)} domain={[min, hi + pad]} />
          {min < 0 && hi > 0 && <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />}
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { date: string; cents: number } | undefined;
              if (!active || !p) return null;
              return <TooltipBox title={formatDate(p.date)} rows={[{ label: "Kontostand", value: formatCents(p.cents), color }]} />;
            }}
          />
          <Area
            type="monotone"
            dataKey="cents"
            stroke={color}
            strokeWidth={2}
            fill="url(#balance-fill)"
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Verlauf (Statistik) ─────────────────────────────────────────────────── */

export function SpendTimeline({
  data,
  unit,
  height = 260,
}: {
  data: { key: string; cents: number }[];
  unit: "day" | "month";
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="key"
            {...axisProps}
            minTickGap={16}
            tickFormatter={(k: string) => (unit === "month" ? formatMonthShort(k) : `${Number(k.slice(8))}.${Number(k.slice(5, 7))}.`)}
          />
          <YAxis {...axisProps} width={56} tickFormatter={(v: number) => formatCentsCompact(v)} />
          <Tooltip
            cursor={{ fill: "var(--default)", opacity: 0.5, radius: 6 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { key: string; cents: number } | undefined;
              if (!active || !p) return null;
              return (
                <TooltipBox
                  title={unit === "month" ? formatMonth(p.key) : formatDate(p.key)}
                  rows={[{ label: "Ausgaben", value: formatCents(p.cents), color: "var(--expense)" }]}
                />
              );
            }}
          />
          <Bar dataKey="cents" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Einnahmen-Verlauf ───────────────────────────────────────────────────── */

export function IncomeBars({ data, height = 220 }: { data: MonthPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" {...axisProps} tickFormatter={(m: string) => formatMonthShort(m)} interval="preserveStartEnd" />
          <YAxis {...axisProps} width={56} tickFormatter={(v: number) => formatCentsCompact(v)} />
          <Tooltip
            cursor={{ fill: "var(--default)", opacity: 0.5, radius: 8 }}
            content={({ active, payload, label }) => {
              const p = payload?.[0]?.payload as MonthPoint | undefined;
              if (!active || !p) return null;
              return (
                <TooltipBox
                  title={formatMonth(String(label))}
                  rows={[{ label: "Einnahmen", value: formatCents(p.incomeCents), color: "var(--income)" }]}
                />
              );
            }}
          />
          <Bar dataKey="incomeCents" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
