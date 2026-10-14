"use client";

import { Button } from "@heroui/react";
import Link from "next/link";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { useAction } from "@/lib/client/use-action";
import type { Anomaly } from "@/lib/domain/anomalies";
import { formatDayShort, formatMoney } from "@/lib/format";
import { dismissAnomaly } from "@/lib/server/actions/matching";
import { deleteTransaction } from "@/lib/server/actions/transactions";

/** Hinweise auf moegliche Doppelbuchungen, ungewoehnlich hohe Ausgaben und Kategorien ueber Ø. */
export function AnomalyPanel({ anomalies }: { anomalies: Anomaly[] }) {
  const { run, pending } = useAction();
  const { openTransaction } = useQuickAdd();
  const dismiss = (key: string) => run(() => dismissAnomaly(key), { silent: true });

  return (
    <Panel id="anomalies" title="Auffälligkeiten" description="Einen zweiten Blick wert – „Passt“ blendet einen Hinweis dauerhaft aus." bodyClassName="">
      <ul className="rows">
        {anomalies.map((anomaly) => (
          <li key={anomaly.key} className="flex flex-col gap-2 px-4 py-3 text-[13.5px] sm:flex-row sm:items-center sm:justify-between sm:px-5">
            {anomaly.kind === "duplicate" ? (
              <Duplicate anomaly={anomaly} />
            ) : anomaly.kind === "large" ? (
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">Ungewöhnlich hoch:</span>
                  <button type="button" className="underline decoration-border underline-offset-4 hover:decoration-foreground" onClick={() => openTransaction("expense", anomaly.transaction)}>
                    {anomaly.transaction.title}
                  </button>
                  <Money cents={-anomaly.transaction.amountCents} signed tone="plain" />
                </div>
                <div className="label font-normal">
                  {formatDayShort(anomaly.transaction.date)} · sonst meist um {formatMoney(anomaly.typical)}
                  {anomaly.categoryName ? ` in ${anomaly.categoryName}` : ""}
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link href={`/kategorien/${anomaly.stat.id}`} className="font-medium underline decoration-border underline-offset-4 hover:decoration-foreground">
                    {anomaly.stat.name}
                  </Link>
                  <span>schon {formatMoney(anomaly.stat.amount)} in diesem Monat</span>
                </div>
                <div className="label font-normal">
                  Ø {formatMoney(anomaly.stat.average ?? 0)} · {formatMoney(anomaly.stat.amount - (anomaly.stat.average ?? 0), { signed: true })}
                </div>
              </div>
            )}
            <div className="flex shrink-0 gap-1.5">
              {anomaly.kind === "duplicate" && (
                <Button size="sm" variant="secondary" isPending={pending} onPress={() => run(() => deleteTransaction(newer(anomaly).id))}>
                  Doppelte löschen
                </Button>
              )}
              <Button size="sm" variant="ghost" onPress={() => dismiss(anomaly.key)}>
                Passt
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Die spaeter angelegte bzw. von Hand erfasste Buchung wird geloescht, die importierte bleibt. */
function newer(anomaly: Extract<Anomaly, { kind: "duplicate" }>) {
  const [a, b] = anomaly.transactions;
  if (a.importId && !b.importId) return b;
  if (b.importId && !a.importId) return a;
  return a.id > b.id ? a : b;
}

function Duplicate({ anomaly }: { anomaly: Extract<Anomaly, { kind: "duplicate" }> }) {
  const { openTransaction } = useQuickAdd();
  const [a, b] = anomaly.transactions;
  const remove = newer(anomaly);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">Möglicherweise doppelt:</span>
        <Money cents={a.type === "income" ? a.amountCents : -a.amountCents} signed tone="plain" />
      </div>
      <div className="label flex flex-wrap gap-x-1 font-normal">
        {[a, b].map((tx, index) => (
          <span key={tx.id}>
            <button type="button" className="underline decoration-border underline-offset-4 hover:decoration-foreground" onClick={() => openTransaction(tx.type, tx)}>
              {tx.title}
            </button>{" "}
            ({formatDayShort(tx.date)}
            {tx.importId ? ", importiert" : ""}
            {tx.status === "pending" ? ", offen" : ""}
            {tx === remove ? ", entfällt bei „Doppelte löschen“" : ""}){index === 0 ? " und" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
