import { formatMoney, MONTH_NAMES } from "@/lib/money";

/** Jahresverlauf: Balkenpaare je Monat plus Saldo-Linie darunter. */
export function YearChart({
  months,
}: {
  months: Array<{ month: string; income: number; expense: number }>;
}) {
  const max = Math.max(
    1,
    ...months.flatMap((entry) => [entry.income, entry.expense]),
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[540px] items-end gap-2">
        {months.map((entry) => {
          const index = Number(entry.month.split("-")[1]) - 1;
          const saldo = entry.income - entry.expense;
          const empty = entry.income === 0 && entry.expense === 0;

          return (
            <div key={entry.month} className="group flex flex-1 flex-col gap-1.5">
              <div className="flex h-40 items-end justify-center gap-1">
                <div
                  className="w-3 rounded-t bg-success/70 transition-colors group-hover:bg-success sm:w-4"
                  style={{ height: `${Math.max(2, (entry.income / max) * 100)}%` }}
                  title={`Einnahmen ${MONTH_NAMES[index]}: ${formatMoney(entry.income)}`}
                />
                <div
                  className="w-3 rounded-t bg-danger/70 transition-colors group-hover:bg-danger sm:w-4"
                  style={{ height: `${Math.max(2, (entry.expense / max) * 100)}%` }}
                  title={`Ausgaben ${MONTH_NAMES[index]}: ${formatMoney(entry.expense)}`}
                />
              </div>

              <span className="text-center text-tiny text-default-400">
                {MONTH_NAMES[index].slice(0, 3)}
              </span>

              <span
                className={`text-center text-[0.65rem] tabular-nums ${
                  empty
                    ? "text-default-300"
                    : saldo >= 0
                      ? "text-success"
                      : "text-danger"
                }`}
              >
                {empty ? "–" : formatMoney(saldo, { compact: true })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
