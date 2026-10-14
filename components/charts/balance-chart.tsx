"use client";

import { useEffect, useRef, useState } from "react";
import { Figures } from "@/components/ui/money";
import { daysBetween } from "@/lib/domain/calendar";
import { formatDayShort, formatMoney } from "@/lib/format";

export type BalancePoint = {
  date: string;
  value: number;
  /** Prognose (gestrichelt) statt gebuchtem Stand. */
  forecast?: boolean;
  changes?: Array<{ title: string; amount: number }>;
  /** Eigene Beschriftung im Tooltip statt des Datums. */
  label?: string;
  /** Zusatzzeile im Tooltip. */
  note?: string;
};

const PAD = { top: 14, right: 12, bottom: 24, left: 56 };

function niceStep(range: number, ticks = 4) {
  const raw = Math.max(range, 100) / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= raw)!;
}

function axisLabel(cents: number) {
  const euros = cents / 100;
  if (Math.abs(euros) >= 1000) return `${(euros / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} T€`;
  return `${euros.toLocaleString("de-DE")} €`;
}

/**
 * Kontostand als Treppenlinie ueber die Zeit: gebucht durchgezogen,
 * Prognose gestrichelt, dazu "heute" und - falls erreicht - die Nulllinie.
 */
export function BalanceChart({
  points,
  today,
  height = 200,
  label,
  step = true,
}: {
  points: BalancePoint[];
  today?: string;
  height?: number;
  label: string;
  /** Treppe (Tageswerte) oder gerade Verbindungen (Monatswerte). */
  step?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (points.length === 0) return null;
  const first = points[0].date;
  const span = Math.max(daysBetween(first, points[points.length - 1].date), 1);
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const stepSize = niceStep(rawMax - rawMin);
  const low = Math.floor(rawMin / stepSize) * stepSize - (rawMin === rawMax ? stepSize : 0);
  const high = Math.ceil(rawMax / stepSize) * stepSize + (rawMin === rawMax ? stepSize : 0);
  const ticks = Array.from({ length: Math.round((high - low) / stepSize) + 1 }, (_, index) => low + index * stepSize);

  const plotWidth = Math.max(width - PAD.left - PAD.right, 0);
  const plotHeight = height - PAD.top - PAD.bottom;
  const x = (date: string) => PAD.left + (daysBetween(first, date) / span) * plotWidth;
  const y = (value: number) => PAD.top + plotHeight - ((value - low) / (high - low || 1)) * plotHeight;

  // Pfade: gebucht und Prognose getrennt, die Prognose beginnt am letzten gebuchten Punkt
  const path = (list: BalancePoint[]) =>
    list
      .map((point, index) => {
        const px = x(point.date);
        const py = y(point.value);
        if (index === 0) return `M${px},${py}`;
        return step ? `H${px}V${py}` : `L${px},${py}`;
      })
      .join("");
  const actual = points.filter((point) => !point.forecast);
  const forecast = points.filter((point) => point.forecast);
  const forecastPath = forecast.length > 0 ? path([...(actual.length ? [actual[actual.length - 1]] : []), ...forecast]) : "";

  const current = active !== null ? points[active] : null;
  const pick = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const offset = clientX - box.left;
    let best = 0;
    for (let index = 1; index < points.length; index += 1) {
      if (Math.abs(x(points[index].date) - offset) <= Math.abs(x(points[best].date) - offset)) best = index;
    }
    setActive(best);
  };

  return (
    <div ref={ref} className="relative touch-pan-y" onMouseMove={(event) => pick(event.clientX)} onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "var(--danger)" : "var(--separator)"} strokeWidth={1} opacity={tick === 0 ? 0.6 : 1} />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
                {axisLabel(tick)}
              </text>
            </g>
          ))}
          {today && today >= first && (
            <g>
              <line x1={x(today)} x2={x(today)} y1={PAD.top} y2={PAD.top + plotHeight} stroke="var(--border)" strokeDasharray="2 3" />
              <text x={x(today)} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">
                heute
              </text>
            </g>
          )}
          <text x={PAD.left} y={height - 8} textAnchor="start" className="fill-muted text-[11px]">
            {formatDayShort(first)}
          </text>
          {(!today || today !== points[points.length - 1].date) && (
            <text x={width - PAD.right} y={height - 8} textAnchor="end" className="fill-muted text-[11px]">
              {formatDayShort(points[points.length - 1].date)}
            </text>
          )}
          {actual.length > 0 && <path d={path(actual)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />}
          {forecastPath && <path d={forecastPath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" opacity={0.8} />}
          {current && (
            <circle cx={x(current.date)} cy={y(current.value)} r={4} fill="var(--background)" stroke="var(--accent)" strokeWidth={2} />
          )}
        </svg>
      )}
      {current && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-56 rounded-[var(--radius)] border border-border bg-overlay p-3 text-[12.5px] shadow-overlay"
          style={{ left: Math.min(Math.max(x(current.date) - 112, 0), Math.max(width - 224, 0)) }}
        >
          <div className="flex justify-between gap-3 font-semibold">
            <span>
              {current.label ?? formatDayShort(current.date)}
              {current.forecast && <span className="font-normal text-muted"> · Prognose</span>}
            </span>
            <span className={current.value < 0 ? "text-danger" : ""}>
              <Figures text={formatMoney(current.value)} />
            </span>
          </div>
          {current.note && <div className="mt-0.5 text-muted">{current.note}</div>}
          {current.changes && current.changes.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5 border-t border-separator pt-1.5">
              {current.changes.slice(0, 4).map((change, index) => (
                <li key={index} className="num flex justify-between gap-3 text-muted">
                  <span className="truncate">{change.title}</span>
                  <span className="shrink-0">
                    <Figures text={formatMoney(change.amount, { signed: true })} />
                  </span>
                </li>
              ))}
              {current.changes.length > 4 && <li className="text-muted">+ {current.changes.length - 4} weitere</li>}
            </ul>
          )}
        </div>
      )}
      {/* Fuer Screenreader die Werte als Liste */}
      <ul className="sr-only">
        {points.map((point, index) => (
          <li key={index}>
            {point.label ?? formatDayShort(point.date)}: {formatMoney(point.value)}
            {point.forecast ? " (Prognose)" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
