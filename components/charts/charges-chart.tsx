"use client";

import { useEffect, useRef, useState } from "react";
import { Figures } from "@/components/ui/money";
import { formatDayShort, formatMoney, formatMonth } from "@/lib/format";

export type ChargeMonth = { month: string; total: number; charges: Array<{ title: string; date: string; amountCents: number }> };

const HEIGHT = 180;
const PAD = { top: 18, right: 8, bottom: 24, left: 8 };

function barPath(x: number, y: number, width: number, height: number) {
  if (height <= 0) return "";
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/**
 * Tatsaechliche Abbuchungen je Monat (Saeulen) gegen den rechnerischen
 * Monatsdurchschnitt (gestrichelte Linie). Zeigt, wann Jahresabos
 * wirklich belasten.
 */
export function ChargesChart({ data, average }: { data: ChargeMonth[]; average: number }) {
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

  const max = Math.max(...data.map((m) => m.total), average, 1);
  const plotWidth = Math.max(width - PAD.left - PAD.right, 0);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = data.length ? plotWidth / data.length : 0;
  const barWidth = Math.max(Math.min(slot - 10, 34), 4);
  const y = (cents: number) => PAD.top + plotHeight - (cents / max) * plotHeight;
  const current = active !== null ? data[active] : null;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="Tatsächliche Abbuchungen der nächsten zwölf Monate" className="block">
          {data.map((month, index) => {
            const x = PAD.left + slot * index + (slot - barWidth) / 2;
            const exceeds = month.total > average * 1.05;
            return (
              <g key={month.month} opacity={active !== null && active !== index ? 0.5 : 1} style={{ transition: "opacity 120ms" }}>
                {month.total > 0 ? (
                  <path d={barPath(x, y(month.total), barWidth, y(0) - y(month.total))} fill={exceeds ? "var(--chart-expense)" : "var(--muted)"} fillOpacity={exceeds ? 1 : 0.45} />
                ) : (
                  <line x1={x} x2={x + barWidth} y1={y(0) - 1} y2={y(0) - 1} stroke="var(--border)" strokeWidth={2} />
                )}
                <text x={PAD.left + slot * index + slot / 2} y={HEIGHT - 6} textAnchor="middle" className="fill-muted text-[11px]">
                  {formatMonth(month.month, { short: true }).replace(/ \d+$/, "")}
                </text>
                <rect
                  x={PAD.left + slot * index}
                  y={0}
                  width={slot}
                  height={HEIGHT}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${formatMonth(month.month)}: ${formatMoney(month.total)} Abbuchungen`}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={y(average)} y2={y(average)} stroke="var(--foreground)" strokeOpacity={0.55} strokeDasharray="4 4" strokeWidth={1} />
          <text x={width - PAD.right} y={y(average) - 5} textAnchor="end" className="fill-muted text-[11px]">
            Ø {formatMoney(average)} / Monat
          </text>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--border)" />
        </svg>
      )}
      {current && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-60 rounded-[var(--radius)] border border-border bg-overlay p-3 text-[12.5px] shadow-overlay"
          style={{ left: Math.min(Math.max(PAD.left + slot * active + slot / 2 - 120, 0), Math.max(width - 240, 0)) }}
        >
          <div className="mb-1.5 flex justify-between font-semibold">
            <span>{formatMonth(current.month)}</span>
            <span className="num">
              <Figures text={formatMoney(current.total)} />
            </span>
          </div>
          {current.charges.length === 0 ? (
            <div className="text-muted">Keine Abbuchung</div>
          ) : (
            current.charges
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 8)
              .map((charge, index) => (
                <div key={index} className="flex justify-between gap-3">
                  <span className="truncate text-muted">
                    {formatDayShort(charge.date)} {charge.title}
                  </span>
                  <span className="num shrink-0">
                    <Figures text={formatMoney(charge.amountCents)} />
                  </span>
                </div>
              ))
          )}
          {current.charges.length > 8 && <div className="mt-1 text-muted">+ {current.charges.length - 8} weitere</div>}
        </div>
      )}
    </div>
  );
}
