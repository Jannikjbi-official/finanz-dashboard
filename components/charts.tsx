import { formatMoney } from "@/lib/money";
import { MONTH_NAMES } from "@/lib/money";

export type Slice = {
  name: string;
  color: string;
  amountCents: number;
};

/** Donut aus reinem SVG - keine Chart-Library noetig. */
export function Donut({
  slices,
  total,
  label,
}: {
  slices: Slice[];
  total: number;
  label: string;
}) {
  const size = 180;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--heroui-default-200))"
            strokeWidth={stroke}
          />
          {total > 0
            ? slices.map((slice) => {
                const fraction = slice.amountCents / total;
                const dash = fraction * circumference;
                const element = (
                  <circle
                    key={slice.name}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={stroke}
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    strokeLinecap="butt"
                  />
                );
                offset += dash;
                return element;
              })
            : null}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-tiny uppercase tracking-wide text-default-400">
            {label}
          </span>
          <span className="text-lg font-semibold">
            {formatMoney(total, { compact: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Einnahmen/Ausgaben der letzten Monate als Balkenpaare. */
export function TrendChart({
  data,
}: {
  data: Array<{ month: string; income: number; expense: number }>;
}) {
  const max = Math.max(
    1,
    ...data.flatMap((entry) => [entry.income, entry.expense]),
  );

  return (
    <div className="flex h-48 items-end gap-3">
      {data.map((entry) => {
        const monthIndex = Number(entry.month.split("-")[1]) - 1;

        return (
          <div
            key={entry.month}
            className="group flex flex-1 flex-col items-center gap-2"
          >
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className="w-1/2 max-w-6 rounded-t-md bg-success/70 transition-all group-hover:bg-success"
                style={{ height: `${Math.max(2, (entry.income / max) * 100)}%` }}
                title={`Einnahmen: ${formatMoney(entry.income)}`}
              />
              <div
                className="w-1/2 max-w-6 rounded-t-md bg-danger/70 transition-all group-hover:bg-danger"
                style={{ height: `${Math.max(2, (entry.expense / max) * 100)}%` }}
                title={`Ausgaben: ${formatMoney(entry.expense)}`}
              />
            </div>
            <span className="text-tiny text-default-400">
              {MONTH_NAMES[monthIndex]?.slice(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Kategorie-Liste mit Fortschrittsbalken (Anteil oder Budget). */
export function CategoryBars({
  slices,
  total,
}: {
  slices: Array<Slice & { icon?: string; budgetCents?: number | null }>;
  total: number;
}) {
  if (slices.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-default-400">
        Noch keine Daten in diesem Monat.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {slices.map((slice) => {
        const share = total > 0 ? (slice.amountCents / total) * 100 : 0;
        const budgetShare =
          slice.budgetCents && slice.budgetCents > 0
            ? (slice.amountCents / slice.budgetCents) * 100
            : null;
        const over = budgetShare !== null && budgetShare > 100;

        return (
          <li key={slice.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: slice.color }}
                />
                <span className="truncate">
                  {slice.icon ? `${slice.icon} ` : ""}
                  {slice.name}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-default-500">
                {formatMoney(slice.amountCents)}
                <span className="ml-2 text-tiny text-default-400">
                  {share.toFixed(0)}%
                </span>
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-default-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(2, share))}%`,
                  background: slice.color,
                }}
              />
            </div>

            {budgetShare !== null ? (
              <span
                className={`text-tiny ${over ? "text-danger" : "text-default-400"}`}
              >
                {over ? "Budget überschritten: " : "Budget: "}
                {formatMoney(slice.amountCents)} / {formatMoney(slice.budgetCents!)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
