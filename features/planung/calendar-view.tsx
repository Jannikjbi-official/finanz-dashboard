"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CaretLeft, CaretRight, Flag } from "@phosphor-icons/react/dist/ssr";
import { addMonths, daysInMonth } from "@/lib/domain/calendar";
import { formatDayWithWeekday, formatMoney, formatMonth } from "@/lib/format";
import { Money } from "@/ui/money";
import { Segmented } from "@/ui/field";
import { cx } from "@/ui/cx";

export type CalendarItem = {
  label: string;
  amountCents: number | null;
  kind: "booked" | "expected" | "deadline";
  note?: string;
};

export type CalendarDay = {
  date: string;
  items: CalendarItem[];
  /** Prognostizierter Stand am Tagesende (nur heute und Zukunft). */
  balanceCents: number | null;
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function CalendarView({
  month,
  today,
  days,
  reserveCents,
  horizonEnd,
}: {
  month: string;
  today: string;
  days: CalendarDay[];
  reserveCents: number;
  horizonEnd: string;
}) {
  const [view, setView] = useState<"month" | "agenda">("month");
  const [selected, setSelected] = useState<string>(month === today.slice(0, 7) ? today : `${month}-01`);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const [year, m] = month.split("-").map(Number);
  const length = daysInMonth(year, m);
  // Montag = 0
  const offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1;
    return day >= 1 && day <= length ? `${month}-${String(day).padStart(2, "0")}` : null;
  });

  const selectedDay = byDate.get(selected);
  const monthItems = days.filter((d) => d.items.length > 0);

  const totals = days.reduce(
    (acc, d) => {
      for (const item of d.items) {
        if (item.amountCents === null) continue;
        if (item.amountCents > 0) acc.in += item.amountCents;
        else acc.out += item.amountCents;
      }
      return acc;
    },
    { in: 0, out: 0 },
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link aria-label="Vorheriger Monat" href={`?monat=${addMonths(`${month}-01`, -1).slice(0, 7)}`} className="rounded-full bg-surface p-2.5 text-ink-2 hover:text-ink">
            <CaretLeft size={16} />
          </Link>
          <h1 className="min-w-48 text-center text-[26px] font-bold tracking-[-0.035em]">{formatMonth(month)}</h1>
          <Link aria-label="Nächster Monat" href={`?monat=${addMonths(`${month}-01`, 1).slice(0, 7)}`} className="rounded-full bg-surface p-2.5 text-ink-2 hover:text-ink">
            <CaretRight size={16} />
          </Link>
          {month !== today.slice(0, 7) ? (
            <Link href="?" className="ml-2 text-[13px] text-accent hover:underline">
              Heute
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-4 text-[13px] text-ink-3">
          <span>
            Ein <Money cents={totals.in} whole className="text-pos" />
          </span>
          <span>
            Aus <Money cents={totals.out} whole className="text-ink" />
          </span>
          <Segmented
            name="calendar-view"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: "month", label: "Monat" },
              { value: "agenda", label: "Liste" },
            ]}
          />
        </div>
      </div>

      {view === "month" ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="card !p-3 sm:!p-4">
            <div className="grid grid-cols-7 pb-2 text-[12px] font-bold text-ink-3">
              {WEEKDAYS.map((d) => (
                <span key={d} className="px-2">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {cells.map((date, index) => {
                if (!date) return <div key={index} className="min-h-16 sm:min-h-24" />;
                const day = byDate.get(date);
                const isToday = date === today;
                const isPast = date < today;
                const net = day?.items.reduce((s, i) => s + (i.amountCents ?? 0), 0) ?? 0;
                const belowReserve = day?.balanceCents !== null && day?.balanceCents !== undefined && day.balanceCents < reserveCents;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelected(date)}
                    aria-pressed={selected === date}
                    aria-label={`${formatDayWithWeekday(date)}${day?.items.length ? `, ${day.items.length} Einträge` : ""}`}
                    className={cx(
                      "flex min-h-16 flex-col items-stretch gap-1 rounded-[12px] border p-1.5 text-left transition-colors sm:min-h-24 sm:rounded-[14px] sm:p-2",
                      selected === date ? "border-accent bg-accent-soft" : "border-transparent bg-surface-2 hover:border-line-strong",
                      isPast && selected !== date && "opacity-60",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span
                        className={cx(
                          "num flex size-6 items-center justify-center rounded-full text-[12px] font-bold",
                          isToday ? "bg-accent text-accent-ink" : isPast ? "text-ink-3" : "text-ink",
                        )}
                      >
                        {Number(date.slice(8))}
                      </span>
                      {day?.items.some((i) => i.kind === "deadline") ? <Flag size={12} className="text-accent" weight="fill" /> : null}
                    </span>
                    {day && day.items.length > 0 ? (
                      <>
                        <span className="hidden truncate text-[11px] font-medium leading-tight text-ink-2 sm:block">
                          {day.items.filter((i) => i.kind !== "deadline")[0]?.label}
                          {day.items.length > 1 ? ` +${day.items.length - 1}` : ""}
                        </span>
                        {net !== 0 ? (
                          <span className={cx("num mt-auto self-end rounded-full px-1.5 py-px text-[10.5px] font-bold", net > 0 ? "bg-pos-soft text-pos" : "bg-sunken text-ink-2")}>
                            {formatMoney(net, { signed: true, whole: true })}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                    {day?.balanceCents !== null && day?.balanceCents !== undefined && !isPast ? (
                      <span className={cx("num hidden text-right text-[10px] font-semibold sm:block", belowReserve ? "text-caution" : "text-ink-3", !(day.items.length > 0 && net !== 0) && "mt-auto")}>
                        {formatMoney(day.balanceCents, { whole: true })}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 px-1 text-[12px] text-ink-3">
              Vergangene Tage: gebuchte Bewegungen. Ab heute: erwartete Ereignisse und der prognostizierte Stand am Tagesende.
              {horizonEnd < `${month}-${String(length).padStart(2, "0")}` ? ` Die Prognose reicht bis ${formatDayWithWeekday(horizonEnd)}.` : ""}
            </p>
          </div>

          <aside className="card self-start">
            <p className="text-[13px] text-ink-3">{selected === today ? "Heute" : selected < today ? "Gebucht" : "Erwartet"}</p>
            <h2 className="text-[20px] font-bold tracking-[-0.03em]">{formatDayWithWeekday(selected)}</h2>
            <DayItems day={selectedDay} />
            {selectedDay?.balanceCents !== null && selectedDay?.balanceCents !== undefined && selected >= today ? (
              <p className="mt-4 border-t border-line pt-3 text-[13px] text-ink-2">
                Stand am Tagesende voraussichtlich <Money cents={selectedDay.balanceCents} className="font-medium" />
              </p>
            ) : null}
          </aside>
        </div>
      ) : (
        <ol className="card flex flex-col gap-1 !p-2">
          {monthItems.length === 0 ? <li className="py-6 text-[14px] text-ink-3">In diesem Monat steht nichts an.</li> : null}
          {monthItems.map((day) => (
            <li key={day.date} className={cx("grid grid-cols-[7rem_1fr] gap-3 rounded-[14px] px-3 py-3 sm:grid-cols-[9rem_1fr]", day.date === today ? "bg-accent-soft" : "hover:bg-surface-2")}>
              <span className={cx("text-[13px]", day.date < today ? "text-ink-3" : "font-medium")}>{formatDayWithWeekday(day.date)}</span>
              <DayItems day={day} compact />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DayItems({ day, compact = false }: { day: CalendarDay | undefined; compact?: boolean }) {
  if (!day || day.items.length === 0) {
    return compact ? null : <p className="mt-3 text-[14px] text-ink-3">Keine Bewegungen.</p>;
  }
  return (
    <ul className={cx("flex flex-col", !compact && "mt-3")}>
      {day.items.map((item, index) => (
        <li key={index} className={cx("flex items-baseline justify-between gap-3", compact ? "py-0.5" : "border-b border-line py-2")}>
          <span className="flex min-w-0 items-baseline gap-2">
            {item.kind === "deadline" ? <Flag size={12} className="shrink-0 text-accent" weight="fill" /> : null}
            <span className={cx("truncate text-[14px]", item.kind === "expected" && "italic")}>{item.label}</span>
            {item.note ? <span className="shrink-0 text-[11px] text-ink-3">{item.note}</span> : null}
          </span>
          {item.amountCents !== null ? <Money cents={item.amountCents} tone="flow" className="text-[14px]" /> : null}
        </li>
      ))}
    </ul>
  );
}
