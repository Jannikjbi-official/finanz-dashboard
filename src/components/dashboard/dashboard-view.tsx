"use client";

import { Button, Card, Chip, Label, Meter, ProgressCircle, ScrollShadow, toast } from "@heroui/react";
import { AlertTriangle, CalendarClock, PiggyBank, Receipt, Repeat, TrendingUp, Wallet } from "lucide-react";
import { useEffect } from "react";
import { BalanceArea, CategoryDonut, ChartLegend, IncomeExpenseBars } from "@/components/charts/lazy";
import { CategoryIcon } from "@/components/common/category-icon";
import { Empty } from "@/components/common/empty";
import { StatCard } from "@/components/common/stat-card";
import { LinkButton } from "@/components/ui/link-button";
import { useQuickAdd } from "@/components/shell/quick-add";
import { formatDayHeading, formatMonth } from "@/lib/dates";
import { formatCents, formatPercent } from "@/lib/money";
import type { DashboardData } from "@/server/queries";

export function DashboardView({ data }: { data: DashboardData }) {
  const { openExpense } = useQuickAdd();
  const { current, previous } = data;
  const hasData = current.incomeCents + current.expenseCents + current.aboCents > 0;
  const progress = Math.round(data.monthProgress * 100);
  const spentRatio = current.incomeCents > 0 ? (current.expenseCents + current.aboCents) / current.incomeCents : 0;

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <BudgetAlerts budgets={data.budgets} month={data.month} />

      {/* Kennzahlen */}
      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Einkommen"
          cents={current.incomeCents}
          previousCents={previous.incomeCents}
          icon={<Wallet className="size-5" />}
          tone="income"
        />
        <StatCard
          label="Ausgaben"
          cents={current.expenseCents}
          previousCents={previous.expenseCents}
          icon={<Receipt className="size-5" />}
          tone="expense"
          goodWhenUp={false}
        />
        <StatCard
          label="Abos"
          cents={current.aboCents}
          previousCents={previous.aboCents}
          icon={<Repeat className="size-5" />}
          tone="accent"
          goodWhenUp={false}
        />
        <StatCard
          label="Übrig"
          cents={current.leftCents}
          previousCents={previous.leftCents}
          icon={<PiggyBank className="size-5" />}
          tone={current.leftCents >= 0 ? "income" : "expense"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Monatsfortschritt */}
        <Card className="rounded-3xl p-5">
          <Card.Header>
            <Card.Title>Monat im Blick</Card.Title>
            <Card.Description>{formatMonth(data.month)}</Card.Description>
          </Card.Header>
          <Card.Content className="gap-6 pt-2">
            <div className="flex items-center gap-5">
              <ProgressCircle
                aria-label="Monat verbraucht"
                value={progress}
                color={spentRatio > data.monthProgress + 0.1 ? "warning" : "accent"}
                className="size-28 shrink-0"
              >
                <ProgressCircle.Track className="size-28" viewBox="0 0 36 36" strokeWidth={3}>
                  <ProgressCircle.TrackCircle cx={18} cy={18} r={16} strokeWidth={3} />
                  <ProgressCircle.FillCircle cx={18} cy={18} r={16} strokeWidth={3} />
                </ProgressCircle.Track>
              </ProgressCircle>
              <div className="min-w-0">
                <p className="tabular text-3xl font-semibold tracking-tight">{progress} %</p>
                <p className="text-sm text-muted">des Monats vorbei</p>
                <p className="mt-2 text-sm">
                  <span className="tabular font-semibold">{formatPercent(spentRatio)}</span>{" "}
                  <span className="text-muted">des Einkommens ausgegeben</span>
                </p>
              </div>
            </div>
            <Meter
              value={data.perDayCents}
              maxValue={Math.max(data.perDayMaxCents, data.perDayCents, 1)}
              color={
                data.perDayCents <= 0 ? "danger" : data.perDayCents < data.perDayMaxCents * 0.3 ? "warning" : "success"
              }
              valueLabel={formatCents(data.perDayCents)}
            >
              <Label>Pro Tag noch verfügbar</Label>
              <Meter.Output className="tabular font-semibold" />
              <Meter.Track>
                <Meter.Fill />
              </Meter.Track>
            </Meter>
            <p className="-mt-3 text-xs text-muted">
              {data.isCurrent
                ? `Noch ${data.daysRemaining} Tag${data.daysRemaining === 1 ? "" : "e"} in diesem Monat.`
                : "Gilt für den laufenden Monat."}
            </p>
          </Card.Content>
        </Card>

        {/* Nächste Abbuchungen */}
        <Card className="rounded-3xl p-5 lg:col-span-1">
          <Card.Header className="flex-row items-center justify-between">
            <div>
              <Card.Title>Nächste Abbuchungen</Card.Title>
              <Card.Description>In den nächsten 7 Tagen</Card.Description>
            </div>
            <CalendarClock className="size-5 text-muted" aria-hidden="true" />
          </Card.Header>
          <Card.Content className="pt-2">
            {data.upcoming.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Keine Abbuchungen in den nächsten 7 Tagen. 🎉</p>
            ) : (
              <ScrollShadow className="max-h-64" hideScrollBar>
                <ul className="flex flex-col gap-1">
                  {data.upcoming.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2.5 hover:bg-default/60">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted">
                          {formatDayHeading(u.date)} · {u.kind === "abo" ? "Abo" : u.kind === "einnahme" ? "Einnahme" : "Wiederkehrend"}
                        </p>
                      </div>
                      <span className={`tabular shrink-0 text-sm font-semibold ${u.kind === "einnahme" ? "text-success" : ""}`}>
                        {u.kind === "einnahme" ? "+" : "−"}
                        {formatCents(u.cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </ScrollShadow>
            )}
          </Card.Content>
        </Card>

        {/* Kategorien */}
        <Card className="rounded-3xl p-5">
          <Card.Header>
            <Card.Title>Ausgaben nach Kategorie</Card.Title>
            <Card.Description>inkl. Abos</Card.Description>
          </Card.Header>
          <Card.Content className="gap-4 pt-2">
            {data.slices.length === 0 ? (
              <Empty
                icon={<Receipt className="size-6" />}
                title="Noch keine Ausgaben"
                text="Erfasse deine erste Ausgabe – dann siehst du hier, wohin dein Geld fließt."
                action={<LinkButton href="/ausgaben?neu=1" size="sm">Ausgabe erfassen</LinkButton>}
                className="py-6"
              />
            ) : (
              <>
                <CategoryDonut data={data.slices} />
                <ul className="flex flex-col gap-1.5">
                  {data.slices.slice(0, 5).map((s) => (
                    <li key={s.name} className="flex items-center gap-3 text-sm">
                      <CategoryIcon icon={s.icon} color={s.color} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="tabular font-medium">{formatCents(s.cents)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card.Content>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        <Card className="rounded-3xl p-5 lg:col-span-3">
          <Card.Header className="flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <Card.Title>Einnahmen vs. Ausgaben</Card.Title>
              <Card.Description>Letzte 12 Monate (Ausgaben inkl. Abos)</Card.Description>
            </div>
            <ChartLegend
              items={[
                { label: "Einnahmen", color: "var(--income)" },
                { label: "Ausgaben", color: "var(--expense)" },
              ]}
            />
          </Card.Header>
          <Card.Content className="pt-3">
            <IncomeExpenseBars data={data.series} />
          </Card.Content>
        </Card>
        <Card className="rounded-3xl p-5 lg:col-span-2">
          <Card.Header>
            <Card.Title>Kontostand-Verlauf</Card.Title>
            <Card.Description>
              Start: <span className="tabular">{formatCents(data.openingCents)}</span>
              {data.balance.length > 0 && (
                <>
                  {" · "}Aktuell:{" "}
                  <span className="tabular font-medium text-foreground">{formatCents(data.balance.at(-1)!.cents)}</span>
                </>
              )}
            </Card.Description>
          </Card.Header>
          <Card.Content className="pt-3">
            {data.balance.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted">Dieser Monat liegt in der Zukunft.</p>
            ) : (
              <BalanceArea data={data.balance} />
            )}
          </Card.Content>
        </Card>
      </div>

      {!hasData && (
        <Card className="rounded-3xl">
          <Empty
            icon={<TrendingUp className="size-6" />}
            title="Willkommen bei Finanzen"
            text="Trage dein Einkommen ein und erfasse Ausgaben – das Dashboard füllt sich automatisch."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/einnahmen" variant="secondary">
                  Einnahme erfassen
                </LinkButton>
                <Button onPress={() => openExpense()}>Ausgabe erfassen</Button>
              </div>
            }
          />
        </Card>
      )}

      {data.budgets.some((b) => b.level !== "ok") && (
        <Card className="rounded-3xl p-5">
          <Card.Header className="flex-row items-center gap-2">
            <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
            <Card.Title>Budget-Warnungen</Card.Title>
          </Card.Header>
          <Card.Content className="flex-row flex-wrap gap-2 pt-3">
            {data.budgets
              .filter((b) => b.level !== "ok")
              .map((b) => (
                <Chip key={b.id} color={b.level === "over" ? "danger" : "warning"} variant="soft">
                  {b.level === "over" ? <AlertTriangle className="size-3" /> : null}
                  <Chip.Label>
                    {b.name}: {formatPercent(b.spentCents / b.budgetCents)} ({formatCents(b.spentCents)} von{" "}
                    {formatCents(b.budgetCents)})
                  </Chip.Label>
                </Chip>
              ))}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

/** Zeigt einmal pro Sitzung einen Toast bei 80 % bzw. 100 % Budget. */
function BudgetAlerts({ budgets, month }: { budgets: DashboardData["budgets"]; month: string }) {
  useEffect(() => {
    for (const b of budgets) {
      if (b.level === "ok") continue;
      const key = `finanzen-budget-toast-${month}-${b.id}-${b.level}`;
      if (sessionStorage.getItem(key)) continue;
      sessionStorage.setItem(key, "1");
      const text = `${formatCents(b.spentCents)} von ${formatCents(b.budgetCents)} ausgegeben`;
      if (b.level === "over") toast.danger(`Budget „${b.name}“ überschritten`, { description: text });
      else toast.warning(`Budget „${b.name}“ zu 80 % erreicht`, { description: text });
    }
  }, [budgets, month]);
  return null;
}
