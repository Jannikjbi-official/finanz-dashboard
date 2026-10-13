"use client";

import { Button } from "@heroui/react";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { Status } from "@/components/ui/status";
import { useAction } from "@/lib/client/use-action";
import type { RecurringMatch } from "@/lib/domain/matching";
import { formatDayShort, formatMoney } from "@/lib/format";
import { dismissRecurringMatch, linkAllSureMatches, linkRecurringPayment } from "@/lib/server/actions/matching";

/**
 * Buchungen, die zu offenen Terminen regelmaessiger Zahlungen passen. Erst
 * zugeordnet zaehlt der Termin nicht mehr als erwartet bzw. offen.
 */
export function MatchPanel({ matches }: { matches: RecurringMatch[] }) {
  const { run, pending } = useAction();
  const sure = matches.filter((match) => match.confidence === "sure").length;

  return (
    <Panel
      id="matches"
      title="Zuordnung prüfen"
      description="Diese Buchungen passen zu offenen regelmäßigen Zahlungen. Solange sie nicht zugeordnet sind, zählen die Termine zusätzlich als erwartet bzw. offen."
      bodyClassName=""
      action={
        sure > 1 ? (
          <Button size="sm" variant="secondary" isPending={pending} onPress={() => run(() => linkAllSureMatches())}>
            Alle {sure} passenden zuordnen
          </Button>
        ) : undefined
      }
    >
      <ul className="rows">
        {matches.map((match) => {
          const tx = match.transaction;
          return (
            <li key={`${match.recurringId}-${match.due}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0 text-[13.5px]">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{tx.title}</span>
                  <span className="text-muted">{formatDayShort(tx.date)}</span>
                  <Money cents={tx.type === "income" ? tx.amountCents : -tx.amountCents} signed tone="plain" className={tx.type === "income" ? "text-success" : ""} />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-muted">
                  <span>
                    → {match.title}, fällig {formatDayShort(match.due)} ({formatMoney(match.expectedCents)})
                  </span>
                  {match.difference !== 0 && <span>· Abweichung {formatMoney(match.difference, { signed: true })}</span>}
                  <Status tone={match.confidence === "sure" ? "success" : "warning"}>{match.confidence === "sure" ? "passt" : "vielleicht"}</Status>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant={match.confidence === "sure" ? "primary" : "secondary"}
                  isPending={pending}
                  onPress={() => run(() => linkRecurringPayment({ recurringId: match.recurringId, due: match.due, transactionId: tx.id }))}
                >
                  Zuordnen
                </Button>
                <Button size="sm" variant="ghost" onPress={() => run(() => dismissRecurringMatch({ recurringId: match.recurringId, transactionId: tx.id }))}>
                  Passt nicht
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
