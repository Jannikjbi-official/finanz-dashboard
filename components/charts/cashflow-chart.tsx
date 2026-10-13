"use client";

import { useEffect, useRef, useState } from "react";
import { Figures } from "@/components/ui/money";
import { formatDayShort, formatMoney, formatMonth } from "@/lib/format";

export type CashflowMonth = { month: string; income: number; expense: number; partial?: boolean; partialFrom?: string | null };

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

/** Runde Achsenschritte: 1, 2, 2.5, 5 x 10^n Euro. */
function niceStep(maxCents: number, ticks = 4) {
  const raw = Math.max(maxCents, 100) / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= raw)!;
  return step;
}

function axisLabel(cents: number) {
  const euros = cents / 100;
  if (euros >= 1000) return `${(euros / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} T€`;
  return `${euros.toLocaleString("de-DE")} €`;
}

/** Saeule mit 4px-Radius nur oben, unten an der Grundlinie verankert. */
function barPath(x: number, y: number, width: number, height: number) {
  if (height <= 0) return "";
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/**
 * Einnahmen und Ausgaben je Monat als gruppierte Saeulen. Eine Achse,
 * Werte per Hover/Fokus, vollstaendige Werte zusaetzlich als Tabelle.
 */
export function CashflowChart({ data }: { data: CashflowMonth[] }) {
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
  }, []);

  const max = Math.max(...data.flatMap((month) => [month.income, month.expense]), 0);
  const step = niceStep(max);
  const top = Math.max(step * Math.ceil(max / step), step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);

  const plotWidth = Math.max(width - PAD.left - PAD.right, 0);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = data.length > 0 ? plotWidth / data.length : 0;
  const barWidth = Math.max(Math.min((slot - 12) / 2, 22), 3);
  const y = (cents: number) => PAD.top + plotHeight - (cents / top) * plotHeight;
  const compact = slot < 44;

  const current = active !== null ? data[active] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-[12.5px] text-muted" aria-hidden={showTable}>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-chart-income" /> Einnahmen
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-chart-expense" /> Ausgaben
          </span>
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
        <div className="relative overflow-x-auto">
          <table className="w-full text-left">
            <thead className="label">
              <tr className="border-b border-separator">
                <th className="py-2 font-medium">Monat</th>
                <th className="py-2 text-right font-medium">Einnahmen</th>
                <th className="py-2 text-right font-medium">Ausgaben</th>
                <th className="py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="num">
              {data.map((month) => (
                <tr key={month.month} className="border-b border-separator last:border-0">
                  <td className="py-2">
                    {formatMonth(month.month)}
                    {month.partial && <span className="text-muted"> ({month.partialFrom ? `ab ${formatDayShort(month.partialFrom)}` : "bisher"})</span>}
                  </td>
                  <td className="py-2 text-right"><Figures text={formatMoney(month.income)} /></td>
                  <td className="py-2 text-right"><Figures text={formatMoney(month.expense)} /></td>
                  <td className={`py-2 text-right ${month.income - month.expense < 0 ? "text-danger" : ""}`}>
                    <Figures text={formatMoney(month.income - month.expense, { signed: true })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
          {width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={`Einnahmen und Ausgaben der letzten ${data.length} Monate`}
              className="block"
            >
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
                const incomeX = center - barWidth - 1;
                const expenseX = center + 1;
                const dimmed = active !== null && active !== index;
                return (
                  <g key={month.month} opacity={dimmed ? 0.45 : 1} style={{ transition: "opacity 120ms" }}>
                    {active === index && (
                      <rect x={PAD.left + slot * index} y={PAD.top} width={slot} height={plotHeight} fill="var(--surface-secondary)" />
                    )}
                    <path d={barPath(incomeX, y(month.income), barWidth, y(0) - y(month.income))} fill="var(--chart-income)" />
                    <path d={barPath(expenseX, y(month.expense), barWidth, y(0) - y(month.expense))} fill="var(--chart-expense)" />
                    {month.partial && (
                      <text x={center} y={PAD.top + 10} textAnchor="middle" className="fill-muted text-[10px]">
                        {month.partialFrom ? `ab ${Number(month.partialFrom.slice(8))}.` : "bisher"}
                      </text>
                    )}
                    {(!compact || index % 2 === data.length % 2) && (
                      <text x={center} y={HEIGHT - 8} textAnchor="middle" className="fill-muted text-[11px]">
                        {formatMonth(month.month, { short: true })}
                      </text>
                    )}
                    {/* Trefferflaeche groesser als die Saeulen */}
                    <rect
                      x={PAD.left + slot * index}
                      y={PAD.top}
                      width={slot}
                      height={plotHeight + PAD.bottom}
                      fill="transparent"
                      tabIndex={0}
                      aria-label={`${formatMonth(month.month)}: Einnahmen ${formatMoney(month.income)}, Ausgaben ${formatMoney(month.expense)}`}
                      onMouseEnter={() => setActive(index)}
                      onFocus={() => setActive(index)}
                      onBlur={() => setActive(null)}
                      className="outline-none"
                    />
                  </g>
                );
              })}
              <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth={1} />
            </svg>
          )}

          {current && active !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-48 rounded-[var(--radius)] border border-border bg-overlay p-3 text-[12.5px] shadow-overlay"
              style={{
                left: Math.min(Math.max(PAD.left + slot * active + slot / 2 - 96, 0), Math.max(width - 192, 0)),
              }}
            >
              <div className="mb-1.5 font-semibold">
                {formatMonth(current.month)}
                {current.partial && <span className="font-normal text-muted"> · {current.partialFrom ? `ab ${formatDayShort(current.partialFrom)}` : "bisher"}</span>}
              </div>
              <div className="num flex justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <span className="size-2 rounded-[2px] bg-chart-income" /> Einnahmen
                </span>
                <Figures text={formatMoney(current.income)} />
              </div>
              <div className="num flex justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <span className="size-2 rounded-[2px] bg-chart-expense" /> Ausgaben
                </span>
                <Figures text={formatMoney(current.expense)} />
              </div>
              <div className="num mt-1.5 flex justify-between gap-3 border-t border-separator pt-1.5">
                <span className="text-muted">Saldo</span>
                <span className={current.income - current.expense < 0 ? "text-danger" : ""}>
                  <Figures text={formatMoney(current.income - current.expense, { signed: true })} />
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
