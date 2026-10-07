"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { adjustGoal, deleteGoal, saveGoal } from "@/lib/actions";
import type { GoalState } from "@/lib/domain/goals";
import { formatMoney, formatMonth, formatPercent } from "@/lib/format";
import { ActionForm, FormError } from "@/ui/action-form";
import { ActionButton } from "@/ui/action-button";
import { Button } from "@/ui/button";
import { AmountInput, Field, Input, Segmented, Select, Textarea } from "@/ui/field";
import { Empty, Figures, Note, PageHeader, Pill } from "@/ui/layout";
import { Money } from "@/ui/money";
import { Sheet } from "@/ui/sheet";
import { centsToInput, type AccountOption } from "@/features/shared/types";

export type GoalView = {
  id: string;
  title: string;
  targetCents: number;
  savedCents: number;
  deadline: string | null;
  color: string;
  note: string | null;
  monthlyContributionCents: number | null;
  accountId: string | null;
  state: GoalState;
};

const STATUS: Record<GoalState["status"], { label: string; tone: "pos" | "warn" | "neutral" | "caution" | "accent" }> = {
  reached: { label: "erreicht", tone: "pos" },
  "on-track": { label: "im Plan", tone: "accent" },
  behind: { label: "hinkt hinterher", tone: "warn" },
  "no-plan": { label: "ohne Sparrate", tone: "neutral" },
  overdue: { label: "Frist verstrichen", tone: "caution" },
};

const COLORS = ["#c6f24e", "#6ee7d8", "#8b9cff", "#ff9a52", "#f472b6", "#f5c451"];

export function GoalsPage({ goals, accounts }: { goals: GoalView[]; accounts: AccountOption[] }) {
  const [editing, setEditing] = useState<GoalView | null>(null);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<GoalView | null>(null);

  const open = goals.filter((g) => !g.state.reached);
  const monthly = open.reduce((s, g) => s + (g.monthlyContributionCents ?? 0), 0);
  const saved = goals.reduce((s, g) => s + g.savedCents, 0);
  const target = goals.reduce((s, g) => s + g.targetCents, 0);

  return (
    <>
      <PageHeader
        title="Ziele"
        description="Wofür du sparst – und ob es mit der aktuellen Rate rechtzeitig reicht."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={15} weight="bold" /> Ziel anlegen
          </Button>
        }
      />

      {goals.length === 0 ? (
        <Empty title="Noch kein Ziel." action={<Button variant="primary" onClick={() => setCreating(true)}>Erstes Ziel anlegen</Button>}>
          Ein Notgroschen, der nächste Urlaub, ein neues Rad. Mit einer monatlichen Sparrate siehst du, wann du es erreichst – und ob ein
          Kauf das Ziel nach hinten schiebt.
        </Empty>
      ) : (
        <>
          <Figures
            className="mb-4"
            items={[
              { label: "Gespart", value: <Money cents={saved} whole />, note: `von ${formatMoney(target, { whole: true })}` },
              { label: "Sparraten", value: <Money cents={monthly} whole />, note: "pro Monat, fließt in die Prognose" },
              { label: "Offene Ziele", value: <span className="num">{open.length}</span> },
            ]}
          />

          <ul className="grid gap-4 md:grid-cols-2">
            {goals.map((goal) => {
              const status = STATUS[goal.state.status];
              return (
                <li key={goal.id} className="card flex flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button type="button" onClick={() => setEditing(goal)} className="text-left">
                      <span className="flex items-center gap-2">
                        <span className="text-[18px] font-bold tracking-[-0.02em] hover:underline">{goal.title}</span>
                        <Pill tone={status.tone}>{status.label}</Pill>
                      </span>
                      {goal.note ? <span className="mt-0.5 block text-[13px] text-ink-3">{goal.note}</span> : null}
                    </button>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => setMoving(goal)}>
                        Ein-/Auszahlen
                      </Button>
                    </div>
                  </div>

                  {/* Fortschritt */}
                  <div className="mt-4 flex items-center gap-4">
                    <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${goal.state.progress * 100}%`, background: goal.color }} />
                    </div>
                    <span className="num w-14 text-right text-[18px] font-extrabold tracking-[-0.03em]" style={{ color: goal.color }}>{formatPercent(goal.state.progress)}</span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-[16px] bg-surface-2 p-4 text-[13px]">
                    <div>
                      <dt className="text-ink-3">Gespart</dt>
                      <dd>
                        <Money cents={goal.savedCents} /> <span className="text-ink-3">/ {formatMoney(goal.targetCents, { whole: true })}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Sparrate</dt>
                      <dd>{goal.monthlyContributionCents ? <><Money cents={goal.monthlyContributionCents} whole /> / Monat</> : "–"}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Erreicht voraussichtlich</dt>
                      <dd>{goal.state.reached ? "erreicht" : goal.state.expectedMonth ? formatMonth(goal.state.expectedMonth) : "ohne Rate offen"}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">{goal.deadline ? `Frist ${formatMonth(goal.deadline.slice(0, 7))}` : "Frist"}</dt>
                      <dd>
                        {goal.deadline && goal.state.requiredMonthlyCents !== null && !goal.state.reached ? (
                          <>
                            nötig <Money cents={goal.state.requiredMonthlyCents} whole /> / Monat
                          </>
                        ) : (
                          "keine"
                        )}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>

          <Note className="mt-6">
            Sparraten werden ab dem nächsten Monatsersten als Abfluss in die Prognose gerechnet, bis das Ziel erreicht ist. Den gesparten
            Stand pflegst du über „Ein-/Auszahlen“.
          </Note>
        </>
      )}

      <GoalSheet key={editing?.id ?? (creating ? "new-open" : "new")} open={editing !== null || creating} onOpenChange={(v) => { if (!v) { setEditing(null); setCreating(false); } }} goal={editing} accounts={accounts} />
      <MoveSheet goal={moving} onClose={() => setMoving(null)} />
    </>
  );
}

function GoalSheet({
  open,
  onOpenChange,
  goal,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: GoalView | null;
  accounts: AccountOption[];
}) {
  const [color, setColor] = useState(goal?.color && COLORS.includes(goal.color) ? goal.color : COLORS[0]);
  const formId = goal ? `goal-${goal.id}` : "goal-new";
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? "Ziel bearbeiten" : "Ziel anlegen"}
      footer={
        <div className="flex items-center justify-between gap-2">
          {goal ? (
            <ActionButton action={deleteGoal} fields={{ id: goal.id }} variant="ghost" size="md" className="text-neg" onDone={() => onOpenChange(false)}>
              Löschen
            </ActionButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button variant="primary" type="submit" form={formId}>
              Speichern
            </Button>
          </div>
        </div>
      }
    >
      <ActionForm id={formId} action={saveGoal} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
        {({ error }) => (
          <>
            {goal ? <input type="hidden" name="id" value={goal.id} /> : null}
            <input type="hidden" name="planField" value="1" />
            <input type="hidden" name="color" value={color} />

            <Field label="Wofür?" htmlFor="goal-title">
              <Input id="goal-title" name="title" required maxLength={60} defaultValue={goal?.title} placeholder="z. B. Notgroschen" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zielbetrag" htmlFor="goal-target">
                <AmountInput id="goal-target" name="target" required defaultValue={centsToInput(goal?.targetCents)} />
              </Field>
              <Field label="Schon gespart" htmlFor="goal-saved">
                <AmountInput id="goal-saved" name="saved" defaultValue={centsToInput(goal?.savedCents ?? 0)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sparrate pro Monat" htmlFor="goal-rate" optional>
                <AmountInput id="goal-rate" name="monthlyContribution" defaultValue={centsToInput(goal?.monthlyContributionCents)} />
              </Field>
              <Field label="Bis wann?" htmlFor="goal-deadline" optional>
                <Input id="goal-deadline" type="date" name="deadline" defaultValue={goal?.deadline ?? ""} />
              </Field>
            </div>
            <Field label="Liegt auf" htmlFor="goal-account" optional>
              <Select id="goal-account" name="accountId" defaultValue={goal?.accountId ?? "none"}>
                <option value="none">Kein bestimmtes Konto</option>
                {accounts
                  .filter((a) => !a.archived)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Notiz" htmlFor="goal-note" optional>
              <Textarea id="goal-note" name="note" rows={2} maxLength={200} defaultValue={goal?.note ?? ""} />
            </Field>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-2">Farbe</legend>
              <div className="flex gap-2">
                {COLORS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`Farbe ${value}`}
                    aria-pressed={color === value}
                    onClick={() => setColor(value)}
                    className="size-7 rounded-xs ring-offset-2 ring-offset-paper aria-pressed:ring-2 aria-pressed:ring-ink"
                    style={{ background: value }}
                  />
                ))}
              </div>
            </fieldset>
            <FormError error={error} />
          </>
        )}
      </ActionForm>
    </Sheet>
  );
}

function MoveSheet({ goal, onClose }: { goal: GoalView | null; onClose: () => void }) {
  const [direction, setDirection] = useState<"deposit" | "withdraw">("deposit");
  return (
    <Sheet
      open={goal !== null}
      onOpenChange={(v) => !v && onClose()}
      title={goal ? goal.title : "Ziel"}
      description={goal ? `Aktuell ${formatMoney(goal.savedCents)} von ${formatMoney(goal.targetCents)}` : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" form="goal-move">
            {direction === "deposit" ? "Einzahlen" : "Entnehmen"}
          </Button>
        </div>
      }
    >
      {goal ? (
        <ActionForm id="goal-move" action={adjustGoal} onSuccess={onClose} className="flex flex-col gap-4">
          {({ error }) => (
            <>
              <input type="hidden" name="id" value={goal.id} />
              <input type="hidden" name="direction" value={direction} />
              <Segmented
                name="goal-direction"
                value={direction}
                onChange={setDirection}
                className="w-full"
                options={[
                  { value: "deposit", label: "Einzahlen" },
                  { value: "withdraw", label: "Entnehmen" },
                ]}
              />
              <Field label="Betrag" htmlFor="goal-move-amount" hint="Ändert nur den Stand des Ziels, nicht deine Kontostände.">
                <AmountInput id="goal-move-amount" name="amount" required autoFocus defaultValue={centsToInput(goal.monthlyContributionCents)} />
              </Field>
              <FormError error={error} />
            </>
          )}
        </ActionForm>
      ) : null}
    </Sheet>
  );
}
