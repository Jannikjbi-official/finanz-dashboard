"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDayWithWeekday, formatMoney } from "@/lib/format";
import { cx } from "./cx";

export type TimelinePoint = { date: string; balanceCents: number };
export type TimelineEvent = { date: string; amountCents: number; label: string };

type Series = {
  /** Gebuchte Vergangenheit bis einschliesslich heute. */
  past: TimelinePoint[];
  /** Prognose ab heute (erster Punkt = heute). */
  future: TimelinePoint[];
  /** Optionale zweite Prognose zum Vergleich (Sandbox, Kaufpruefung). */
  compare?: TimelinePoint[];
  compareLabel?: string;
  futureLabel?: string;
};

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/**
 * Die Zeitachse: Kontostand von der Vergangenheit ueber heute in die
 * Prognose, mit der Mindestreserve als schraffierter Zone.
 */
export function TimelineChart({
  series,
  events = [],
  reserveCents,
  height = 220,
  className,
  ariaLabel,
}: {
  series: Series;
  events?: TimelineEvent[];
  reserveCents: number;
  height?: number;
  className?: string;
  ariaLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const model = useMemo(() => {
    const points = [...series.past.slice(0, -1), ...series.future];
    const pastCount = Math.max(0, series.past.length - 1);
    const values = [...points.map((p) => p.balanceCents), ...(series.compare ?? []).map((p) => p.balanceCents)];
    let min = Math.min(...values);
    let max = Math.max(...values);
    // Reserve und Nulllinie nur einbeziehen, wenn sie in der Naehe liegen -
    // sonst wird die eigentliche Linie platt gedrueckt.
    const near = (value: number) => value >= min - (max - min) * 0.6;
    const reserveVisible = reserveCents > 0 && near(reserveCents);
    if (reserveVisible) min = Math.min(min, reserveCents);
    if (min < 0 || near(0)) min = Math.min(min, 0);
    if (max === min) max = min + 100_00;
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;

    const eventsByDate = new Map<string, TimelineEvent[]>();
    for (const event of events) eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]);

    return { points, pastCount, min, max, ticks: niceTicks(min, max, 4), eventsByDate, reserveVisible };
  }, [series, events, reserveCents]);

  const left = 4;
  const right = 64;
  const top = 18;
  const bottom = 26;
  const innerW = Math.max(1, width - left - right);
  const innerH = height - top - bottom;
  const n = model.points.length;

  const x = (index: number) => left + (n <= 1 ? 0 : (index / (n - 1)) * innerW);
  const y = (cents: number) => top + (1 - (cents - model.min) / (model.max - model.min)) * innerH;

  const path = (from: number, to: number, source = model.points) =>
    source
      .slice(from, to + 1)
      .map((point, i) => `${i === 0 ? "M" : "L"}${x(from + i).toFixed(1)},${y(point.balanceCents).toFixed(1)}`)
      .join(" ");

  const todayIndex = model.pastCount;
  const futureEnd = n - 1;
  const comparePath = series.compare
    ? series.compare.map((p, i) => `${i === 0 ? "M" : "L"}${x(todayIndex + i).toFixed(1)},${y(p.balanceCents).toFixed(1)}`).join(" ")
    : null;

  // Tiefster Punkt der Prognose
  let lowIndex = todayIndex;
  for (let i = todayIndex; i < n; i += 1) {
    if (model.points[i].balanceCents < model.points[lowIndex].balanceCents) lowIndex = i;
  }

  const monthTicks = model.points
    .map((point, index) => ({ point, index }))
    .filter(({ point, index }) => point.date.endsWith("-01") && index > 0);

  const reserveY = y(reserveCents);
  const hoverPoint = hover !== null ? model.points[hover] : null;
  const hoverEvents = hoverPoint ? (model.eventsByDate.get(hoverPoint.date) ?? []) : [];

  function onMove(event: React.PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
  }

  return (
    <div ref={wrap} className={cx("relative w-full select-none", className)} style={{ height }}>
      {width > 0 && n > 1 ? (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          <defs>
            <pattern id="reserve-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--caution)" strokeOpacity="0.28" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Raster */}
          {model.ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={left + innerW} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth="1" />
              <text x={left + innerW + 8} y={y(tick) + 4} className="num" fontSize="11" fill="var(--ink-3)">
                {formatMoney(tick, { whole: true })}
              </text>
            </g>
          ))}

          {/* Reserve-Zone */}
          {model.reserveVisible ? (
            <g>
              <rect x={left} y={reserveY} width={innerW} height={Math.max(0, top + innerH - reserveY)} fill="url(#reserve-hatch)" />
              <line x1={left} x2={left + innerW} y1={reserveY} y2={reserveY} stroke="var(--caution)" strokeWidth="1" strokeDasharray="2 3" />
              <text x={left + 4} y={reserveY - 5} fontSize="11" fill="var(--caution)">
                Reserve {formatMoney(reserveCents, { whole: true })}
              </text>
            </g>
          ) : reserveCents > 0 ? (
            <text x={left + 4} y={top + innerH - 6} fontSize="11" fill="var(--ink-3)">
              Reserve {formatMoney(reserveCents, { whole: true })} – weit unterhalb
            </text>
          ) : null}

          {/* Nulllinie */}
          {model.min < 0 ? (
            <line x1={left} x2={left + innerW} y1={y(0)} y2={y(0)} stroke="var(--neg)" strokeWidth="1" />
          ) : null}

          {/* Monatsgrenzen */}
          {monthTicks.map(({ point, index }) => (
            <g key={point.date}>
              <line x1={x(index)} x2={x(index)} y1={top + innerH} y2={top + innerH + 5} stroke="var(--line-strong)" />
              <text x={x(index)} y={height - 6} fontSize="11" textAnchor="middle" fill="var(--ink-3)">
                {MONTHS[Number(point.date.slice(5, 7)) - 1]}
              </text>
            </g>
          ))}

          {/* Heute */}
          <line x1={x(todayIndex)} x2={x(todayIndex)} y1={top - 6} y2={top + innerH} stroke="var(--ink-3)" strokeWidth="1" />
          <text x={x(todayIndex)} y={top - 9} fontSize="11" textAnchor="middle" fill="var(--ink-2)" fontWeight="500">
            Heute
          </text>

          {/* Linien */}
          {todayIndex > 0 ? <path d={path(0, todayIndex)} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" /> : null}
          {comparePath ? (
            <path d={comparePath} fill="none" stroke="var(--ink-3)" strokeWidth="1.4" strokeDasharray="1 3" strokeLinecap="round" />
          ) : null}
          <path d={path(todayIndex, futureEnd)} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeDasharray="5 3" strokeLinejoin="round" />

          {/* Ereignisse auf der Prognoselinie */}
          {model.points.map((point, index) =>
            index >= todayIndex && model.eventsByDate.has(point.date) ? (
              <circle
                key={point.date}
                cx={x(index)}
                cy={y(point.balanceCents)}
                r="2.4"
                fill="var(--paper)"
                stroke="var(--accent)"
                strokeWidth="1.3"
              />
            ) : null,
          )}

          {/* Tiefpunkt */}
          {lowIndex > todayIndex ? (
            <g>
              <circle cx={x(lowIndex)} cy={y(model.points[lowIndex].balanceCents)} r="4" fill="none" stroke="var(--ink)" strokeWidth="1.2" />
              <text
                x={x(lowIndex)}
                y={y(model.points[lowIndex].balanceCents) + 17}
                fontSize="11"
                textAnchor={lowIndex > n * 0.85 ? "end" : "middle"}
                fill="var(--ink-2)"
              >
                Tiefpunkt
              </text>
            </g>
          ) : null}

          {/* Hover */}
          {hover !== null && hoverPoint ? (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + innerH} stroke="var(--ink)" strokeOpacity="0.35" />
              <circle cx={x(hover)} cy={y(hoverPoint.balanceCents)} r="3.5" fill="var(--ink)" />
            </g>
          ) : null}

          <rect
            x={left}
            y={0}
            width={innerW}
            height={height}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      ) : null}

      {hover !== null && hoverPoint ? (
        <div
          className="pointer-events-none absolute top-0 z-10 w-56 rounded-sm border border-line bg-paper px-3 py-2.5 text-[12px] shadow-float"
          style={{
            left: Math.min(Math.max(0, x(hover) - 112), Math.max(0, width - 224)),
            transform: "translateY(-100%) translateY(-6px)",
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-ink-3">
              {formatDayWithWeekday(hoverPoint.date)}
              {hover > todayIndex ? " · Prognose" : hover === todayIndex ? " · heute" : ""}
            </span>
          </div>
          <p className="num mt-0.5 text-[15px] font-medium">{formatMoney(hoverPoint.balanceCents)}</p>
          {hoverEvents.length > 0 ? (
            <ul className="mt-1.5 flex flex-col gap-0.5 border-t border-line pt-1.5">
              {hoverEvents.slice(0, 4).map((event, index) => (
                <li key={index} className="flex justify-between gap-2">
                  <span className="truncate text-ink-2">{event.label}</span>
                  <span className={cx("num", event.amountCents > 0 ? "text-pos" : "text-ink")}>
                    {formatMoney(event.amountCents, { signed: true })}
                  </span>
                </li>
              ))}
              {hoverEvents.length > 4 ? <li className="text-ink-3">+ {hoverEvents.length - 4} weitere</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {series.compare ? (
        <div className="absolute right-16 top-0 flex gap-4 text-[11px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <svg width="18" height="4" aria-hidden>
              <line x1="0" y1="2" x2="18" y2="2" stroke="var(--accent)" strokeWidth="1.8" strokeDasharray="5 3" />
            </svg>
            {series.futureLabel ?? "Prognose"}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="4" aria-hidden>
              <line x1="0" y1="2" x2="18" y2="2" stroke="var(--ink-3)" strokeWidth="1.4" strokeDasharray="1 3" strokeLinecap="round" />
            </svg>
            {series.compareLabel ?? "Vergleich"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Runde Achsenwerte (1, 2, 2,5, 5 x 10^n). */
function niceTicks(min: number, max: number, count: number) {
  const span = max - min;
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) ticks.push(Math.round(value) || 0);
  return ticks;
}
