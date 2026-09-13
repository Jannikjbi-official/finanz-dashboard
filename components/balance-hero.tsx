import NextLink from "next/link";
import { formatMoney } from "@/lib/money";
import { surface } from "@/components/ui";

/**
 * Die grosse Zahl oben auf dem Dashboard: was unterm Strich noch da ist,
 * und was in diesem Monat noch rausgeht.
 */
export function BalanceHero({
  availableCents,
  fromAccounts,
  accountCount,
  incomeTotalCents,
  expenseTotalCents,
  monthExpenseCents,
  openRecurringCents,
  openRecurringCount,
}: {
  availableCents: number;
  fromAccounts: boolean;
  accountCount: number;
  incomeTotalCents: number;
  expenseTotalCents: number;
  monthExpenseCents: number;
  openRecurringCents: number;
  openRecurringCount: number;
}) {
  const afterFixed = availableCents - openRecurringCents;

  return (
    <section
      className={`${surface} grid gap-6 rounded-large p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10`}
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-tiny font-medium uppercase tracking-wider text-default-400">
            {fromAccounts ? "Auf deinen Konten" : "Übrig insgesamt"}
          </p>
          <p
            className={`mt-1 text-4xl font-semibold leading-none tabular-nums sm:text-5xl ${
              availableCents >= 0 ? "text-foreground" : "text-danger"
            }`}
          >
            {formatMoney(availableCents)}
          </p>
          <p className="mt-2 text-tiny text-default-400">
            {fromAccounts ? (
              <>
                Summe aus {accountCount} {accountCount === 1 ? "Konto" : "Konten"} ·{" "}
                <NextLink href="/konten" className="text-primary hover:underline">
                  Konten ansehen
                </NextLink>
              </>
            ) : (
              <>
                Alle Einnahmen minus alle Ausgaben ·{" "}
                <NextLink href="/konten" className="text-primary hover:underline">
                  Konten anlegen für echte Kontostände
                </NextLink>
              </>
            )}
          </p>
        </div>

        {openRecurringCount > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-warning/10 px-3 py-2 text-tiny">
            <span className="font-medium text-warning">
              {formatMoney(openRecurringCents)} stehen diesen Monat noch an
            </span>
            <span className="text-default-400">
              ({openRecurringCount} {openRecurringCount === 1 ? "Abo" : "Abos"}) ·
              danach bleiben {formatMoney(afterFixed)}
            </span>
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-3 gap-4 border-t border-default-100/70 pt-4 lg:min-w-[20rem] lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
        <div>
          <dt className="text-tiny text-default-400">Diesen Monat</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-danger">
            {formatMoney(monthExpenseCents)}
          </dd>
        </div>
        <div>
          <dt className="text-tiny text-default-400">Ausgaben gesamt</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {formatMoney(expenseTotalCents)}
          </dd>
        </div>
        <div>
          <dt className="text-tiny text-default-400">Einnahmen gesamt</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-success">
            {formatMoney(incomeTotalCents)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
