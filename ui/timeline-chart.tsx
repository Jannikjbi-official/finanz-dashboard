"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const gid = useId().replace(/:/g, "");

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
  const right = 70;
  const top = 26;
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

  // Flaechen unter den Linien
  const area = (from: number, to: number, source = model.points, offset = 0) => {
    const line = source
      .slice(from - offset, to - offset + 1)
      .map((point, i) => `${i === 0 ? "M" : "L"}${x(from + i).toFixed(1)},${y(point.balanceCents).toFixed(1)}`)
      .join(" ");
    return `${line} L${x(to).toFixed(1)},${(top + innerH).toFixed(1)} L${x(from).toFixed(1)},${(top + innerH).toFixed(1)} Z`;
  };
  const low = model.points[lowIndex];
  const lowLabelAnchor = lowIndex > n * 0.82 ? "end" : lowIndex < n * 0.18 ? "start" : "middle";

  return (
    <div ref={wrap} className={cx("relative w-full select-none", className)} style={{ height }}>
      {width > 0 && n > 1 ? (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          <defs>
            <linearGradient id={`${gid}-future`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${gid}-past`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Raster */}
          {model.ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={left + innerW} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 5" />
              <text x={left + innerW + 10} y={y(tick) + 4} className="num" fontSize="11" fontWeight="600" fill="var(--ink-3)">
                {formatMoney(tick, { whole: true })}
              </text>
            </g>
          ))}

          {/* Reserve-Zone */}
          {model.reserveVisible ? (
            <g>
              <rect x={left} y={reserveY} width={innerW} height={Math.max(0, top + innerH - reserveY)} fill="var(--caution)" fillOpacity="0.07" rx="6" />
              <line x1={left} x2={left + innerW} y1={reserveY} y2={reserveY} stroke="var(--caution)" strokeWidth="1.2" strokeDasharray="4 4" />
              <text x={left + 8} y={reserveY - 7} fontSize="11" fontWeight="700" fill="var(--caution)">
                Reserve {formatMoney(reserveCents, { whole: true })}
              </text>
            </g>
          ) : reserveCents > 0 ? (
            <text x={left + 4} y={top + innerH - 6} fontSize="11" fill="var(--ink-3)">
              Reserve {formatMoney(reserveCents, { whole: true })} – weit unterhalb
            </text>
          ) : null}

          {/* Nulllinie */}
          {model.min < 0 ? <line x1={left} x2={left + innerW} y1={y(0)} y2={y(0)} stroke="var(--neg)" strokeWidth="1.2" /> : null}

          {/* Monate */}
          {monthTicks.map(({ point, index }) => (
            <text key={point.date} x={x(index)} y={height - 6} fontSize="11" fontWeight="600" textAnchor="middle" fill="var(--ink-3)">
              {MONTHS[Number(point.date.slice(5, 7)) - 1]}
            </text>
          ))}

          {/* Flaechen und Linien */}
          {todayIndex > 0 ? (
            <>
              <path d={area(0, todayIndex)} fill={`url(#${gid}-past)`} />
              <path d={path(0, todayIndex)} fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : null}
          {comparePath ? (
            <path d={comparePath} fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
          ) : null}
          <path d={area(todayIndex, futureEnd)} fill={`url(#${gid}-future)`} />
          <path d={path(todayIndex, futureEnd)} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />

          {/* Heute */}
          <line x1={x(todayIndex)} x2={x(todayIndex)} y1={top} y2={top + innerH} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 4" />
          <g transform={`translate(${x(todayIndex)},${top - 4})`}>
            <rect x={-22} y={-14} width={44} height={18} rx={9} fill="var(--ink)" />
            <text y={-1} fontSize="10.5" fontWeight="700" textAnchor="middle" fill="var(--paper)">
              Heute
            </text>
          </g>
          <circle cx={x(todayIndex)} cy={y(model.points[todayIndex].balanceCents)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2.5" />

          {/* Ereignisse auf der Prognoselinie */}
          {model.points.map((point, index) =>
            index > todayIndex && model.eventsByDate.has(point.date) ? (
              <circle key={point.date} cx={x(index)} cy={y(point.balanceCents)} r="2.6" fill="var(--accent)" />
            ) : null,
          )}

          {/* Tiefpunkt */}
          {lowIndex > todayIndex ? (
            <g>
              <circle cx={x(lowIndex)} cy={y(low.balanceCents)} r="5.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
              <text x={x(lowIndex)} y={y(low.balanceCents) + 20} fontSize="11" fontWeight="700" textAnchor={lowLabelAnchor} fill="var(--ink)">
                Tiefpunkt {formatMoney(low.balanceCents, { whole: true })}
              </text>
            </g>
          ) : null}

          {/* Hover */}
          {hover !== null && hoverPoint ? (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + innerH} stroke="var(--ink)" strokeOpacity="0.4" />
              <circle cx={x(hover)} cy={y(hoverPoint.balanceCents)} r="5" fill="var(--ink)" stroke="var(--surface)" strokeWidth="2" />
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
          className="pointer-events-none absolute top-0 z-10 w-56 rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-[12px] shadow-float"
          style={{
            left: Math.min(Math.max(0, x(hover) - 112), Math.max(0, width - 224)),
            transform: "translateY(-100%) translateY(-8px)",
          }}
        >
          <span className="font-medium text-ink-3">
            {formatDayWithWeekday(hoverPoint.date)}
            {hover > todayIndex ? " · Prognose" : hover === todayIndex ? " · heute" : ""}
          </span>
          <p className="num mt-0.5 text-[17px] font-bold tracking-[-0.02em]">{formatMoney(hoverPoint.balanceCents)}</p>
          {hoverEvents.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
              {hoverEvents.slice(0, 4).map((event, index) => (
                <li key={index} className="flex justify-between gap-2">
                  <span className="truncate text-ink-2">{event.label}</span>
                  <span className={cx("num font-semibold", event.amountCents > 0 ? "text-pos" : "text-ink")}>
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
        <div className="absolute left-0 top-0 flex gap-4 text-[11px] font-semibold text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full bg-accent" />
            {series.futureLabel ?? "Prognose"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full bg-ink-3" />
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
