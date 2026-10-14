"use client";

import { useEffect, useRef, useState } from "react";
import { Figures } from "@/components/ui/money";
import { formatDayShort, formatMoney, formatMonth } from "@/lib/format";

export type MonthBar = { month: string; amount: number; count: number; partialFrom: string | null; current: boolean };

const HEIGHT = 200;
const PAD = { top: 14, right: 8, bottom: 26, left: 52 };

function niceStep(maxCents: number, ticks = 4) {
  const raw = Math.max(maxCents, 100) / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= raw)!;
}

function axisLabel(cents: number) {
  const euros = cents / 100;
  if (euros >= 1000) return `${(euros / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} T€`;
  return `${euros.toLocaleString("de-DE")} €`;
}

function barPath(x: number, y: number, width: number, height: number) {
  if (height <= 0) return "";
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/**
 * Betraege einer Kategorie je Monat, dazu der Durchschnitt vollstaendiger
 * Monate als gestrichelte Linie. Der laufende Monat ist heller.
 */
export function MonthBars({ data, average, color }: { data: MonthBar[]; average: number | null; color: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [showTable]);

  const fill = color ?? "var(--chart-expense)";
  const max = Math.max(...data.map((month) => month.amount), average ?? 0, 0);
  const step = niceStep(max);
  const top = Math.max(step * Math.ceil(max / step), step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const plotWidth = Math.max(width - PAD.left - PAD.right, 0);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = data.length > 0 ? plotWidth / data.length : 0;
  const barWidth = Math.max(Math.min(slot - 10, 34), 4);
  const y = (cents: number) => PAD.top + plotHeight - (cents / top) * plotHeight;
  const compact = slot < 40;
  const current = active !== null ? data[active] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-[12.5px] text-muted" aria-hidden={showTable}>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ background: fill }} /> Gebucht
          </span>
          {average !== null && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 border-t-2 border-dashed border-muted" /> Ø {formatMoney(average)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          className="rounded-[var(--radius)] px-2 py-1 text-[12.5px] text-muted transition-colors hover:bg-default hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
        >
          {showTable ? "Diagramm anzeigen" : "Als Tabelle"}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-left">
          <thead className="label">
            <tr className="border-b border-separator">
              <th className="py-2 font-medium">Monat</th>
              <th className="py-2 text-right font-medium">Buchungen</th>
              <th className="py-2 text-right font-medium">Betrag</th>
            </tr>
          </thead>
          <tbody className="num">
            {data.map((month) => (
              <tr key={month.month} className="border-b border-separator last:border-0">
                <td className="py-2">
                  {formatMonth(month.month)}
                  {(month.current || month.partialFrom) && (
                    <span className="text-muted"> ({month.partialFrom ? `ab ${formatDayShort(month.partialFrom)}` : "bisher"})</span>
                  )}
                </td>
                <td className="py-2 text-right">{month.count}</td>
                <td className="py-2 text-right">
                  <Figures text={formatMoney(month.amount)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
          {width > 0 && (
            <svg width={width} height={HEIGHT} role="img" aria-label={`Beträge der letzten ${data.length} Monate`} className="block">
              {ticks.map((tick) => (
                <g key={tick}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--separator)" strokeWidth={1} />
                  <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
                    {axisLabel(tick)}
                  </text>
                </g>
              ))}
              {data.map((month, index) => {
                const center = PAD.left + slot * index + slot / 2;
                const dimmed = active !== null && active !== index;
                return (
                  <g key={month.month} opacity={dimmed ? 0.45 : 1} style={{ transition: "opacity 120ms" }}>
                    {active === index && <rect x={PAD.left + slot * index} y={PAD.top} width={slot} height={plotHeight} fill="var(--surface-secondary)" />}
                    <path
                      d={barPath(center - barWidth / 2, y(month.amount), barWidth, y(0) - y(month.amount))}
                      fill={fill}
                      opacity={month.current || month.partialFrom ? 0.55 : 1}
                    />
                    {(!compact || index % 2 === data.length % 2) && (
                      <text x={center} y={HEIGHT - 8} textAnchor="middle" className="fill-muted text-[11px]">
                        {formatMonth(month.month, { short: true })}
                      </text>
                    )}
                    <rect
                      x={PAD.left + slot * index}
                      y={PAD.top}
                      width={slot}
                      height={plotHeight + PAD.bottom}
                      fill="transparent"
                      tabIndex={0}
                      aria-label={`${formatMonth(month.month)}: ${formatMoney(month.amount)}, ${month.count} Buchungen`}
                      onMouseEnter={() => setActive(index)}
                      onFocus={() => setActive(index)}
                      onBlur={() => setActive(null)}
                      className="outline-none"
                    />
                  </g>
                );
              })}
              {average !== null && average > 0 && (
                <line x1={PAD.left} x2={width - PAD.right} y1={y(average)} y2={y(average)} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 4" />
              )}
              <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth={1} />
            </svg>
          )}
          {current && active !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-44 rounded-[var(--radius)] border border-border bg-overlay p-3 text-[12.5px] shadow-overlay"
              style={{ left: Math.min(Math.max(PAD.left + slot * active + slot / 2 - 88, 0), Math.max(width - 176, 0)) }}
            >
              <div className="mb-1 font-semibold">
                {formatMonth(current.month)}
                {(current.current || current.partialFrom) && (
                  <span className="font-normal text-muted"> · {current.partialFrom ? `ab ${formatDayShort(current.partialFrom)}` : "bisher"}</span>
                )}
              </div>
              <div className="num flex justify-between gap-3">
                <span className="text-muted">{current.count} Buchungen</span>
                <span className="shrink-0">
                  <Figures text={formatMoney(current.amount)} />
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
