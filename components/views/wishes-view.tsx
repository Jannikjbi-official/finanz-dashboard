"use client";

import { ArrowSquareOut, DotsThreeVertical, Plus, UploadSimple } from "@phosphor-icons/react";
import { Button, Checkbox, Dropdown, Label, Tabs, type Key } from "@heroui/react";
import { useState } from "react";
import { ImportList } from "@/components/finance/import-list";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DateInput, MoneyInput, NoteInput, SelectInput, TextInput } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Segmented } from "@/components/forms/transaction-dialog";
import { WishImportDialog } from "@/components/forms/wish-import-dialog";
import { useQuickAdd } from "@/components/shell/quick-add";
import { Figures, Money } from "@/components/ui/money";
import { PageHeader, Panel, SummaryCell } from "@/components/ui/panel";
import { Status } from "@/components/ui/status";
import { useAction } from "@/lib/client/use-action";
import { daysBetween } from "@/lib/domain/calendar";
import type { ImportInfo, WishPriority, WishStatus } from "@/lib/domain/types";
import type { WishSummary, WishView } from "@/lib/domain/wishes";
import { formatAmountInput, formatDate, formatDayShort, formatMoney, formatRelativeDays } from "@/lib/format";
import { deleteWish, markWishBought, planWish, saveWish, setWishStatus, unplanWish } from "@/lib/server/actions/wishes";

type Dialog =
  | { kind: "edit"; wish: WishView | null }
  | { kind: "plan" | "bought" | "delete"; wish: WishView }
  | { kind: "import" }
  | null;

const TABS: Array<{ id: WishStatus; label: string; empty: string }> = [
  { id: "idea", label: "Wünsche", empty: "Keine offenen Wünsche." },
  { id: "planned", label: "Eingeplant", empty: "Noch nichts eingeplant. Plane einen Wunsch ein, damit er in „Aktuell verfügbar“ zählt." },
  { id: "bought", label: "Gekauft", empty: "Noch nichts gekauft." },
  { id: "dropped", label: "Verworfen", empty: "Nichts verworfen." },
];

const PRIORITY_LABEL: Record<WishPriority, string> = { high: "Wichtig", normal: "Normal", low: "Später" };

export function WishesView({
  wishes,
  summary,
  forecast,
  imports,
}: {
  wishes: WishView[];
  summary: WishSummary;
  forecast: { monthEnd: string; projected: number; available: number };
  imports: ImportInfo[];
}) {
  const { lookups } = useQuickAdd();
  const [tab, setTab] = useState<Key>(summary.ideas.count === 0 && summary.planned.count > 0 ? "planned" : "idea");
  const [dialog, setDialog] = useState<Dialog>(null);
  const { run, pending } = useAction();
  const close = () => setDialog(null);
  const endLabel = formatDayShort(forecast.monthEnd);

  const actions = (
    <>
      <Button size="sm" variant="secondary" onPress={() => setDialog({ kind: "import" })}>
        <UploadSimple className="size-4" /> CSV importieren
      </Button>
      <Button size="sm" onPress={() => setDialog({ kind: "edit", wish: null })}>
        <Plus weight="bold" className="size-4" /> Wunsch hinzufügen
      </Button>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Wünsche"
        description="Was du kaufen möchtest. Ein Wunsch ändert keine Zahl – erst wenn du ihn einplanst, zählt er in „Aktuell verfügbar“."
        actions={actions}
      />

      {wishes.length === 0 ? (
        <Panel>
          <div className="py-8 text-center">
            <p className="font-medium">Noch keine Wünsche</p>
            <p className="mx-auto mt-1 max-w-md text-muted">
              Trag ein, was du dir kaufen willst – mit Preis, Wunschtermin und optional einem Sparziel. Oder übernimm eine Liste per CSV.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          <section className="panel grid grid-cols-2 divide-separator md:grid-cols-4 md:divide-x" aria-label="Überblick">
            <SummaryCell
              label="Wunschliste"
              value={<Figures text={formatMoney(summary.ideas.total)} />}
              hint={`${summary.ideas.count} ${summary.ideas.count === 1 ? "Wunsch" : "Wünsche"}${summary.ideas.undated ? ` · ${summary.ideas.undated} ohne Termin` : ""}`}
            />
            <SummaryCell
              label="Eingeplant"
              value={<Figures text={formatMoney(summary.planned.total)} />}
              hint={`${summary.planned.count} ${summary.planned.count === 1 ? "Kauf" : "Käufe"} · zählt in „Verfügbar“`}
            />
            <SummaryCell
              label={`Bis ${endLabel} eingeplant`}
              value={<Figures text={formatMoney(summary.planned.thisMonth)} />}
              hint={summary.ideas.dueThisMonth ? `dazu ${formatMoney(summary.ideas.dueThisMonth)} Wünsche mit Termin` : "ist in „Aktuell verfügbar“ abgezogen"}
            />
            <SummaryCell
              label={`Voraussichtlich am ${endLabel}`}
              value={<Figures text={formatMoney(forecast.projected)} />}
              hint={
                summary.ideas.dueThisMonth
                  ? `mit allen Wünschen bis dahin: ${formatMoney(forecast.projected - summary.ideas.dueThisMonth)}`
                  : "nach allen eingeplanten Käufen"
              }
            />
          </section>

          {summary.groups.length > 0 && (
            <Panel title="Sparziele" description="Wünsche mit gleicher Gruppe, z. B. alles für ein Setup">
              <ul className="rows">
                {summary.groups.map((group) => (
                  <li key={group.name} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{group.name}</span>
                      <span className="label block font-normal">
                        {group.count} {group.count === 1 ? "Posten" : "Posten"}
                        {group.earliest ? ` · frühestens ${formatDate(group.earliest)}` : " · Zeitpunkt offen"}
                        {group.planned ? ` · davon ${formatMoney(group.planned)} eingeplant` : ""}
                      </span>
                    </span>
                    <Money cents={group.total} className="shrink-0 font-semibold" />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Tabs selectedKey={tab} onSelectionChange={setTab} variant="secondary">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Status">
                {TABS.map((entry) => (
                  <Tabs.Tab key={entry.id} id={entry.id}>
                    {entry.label} <span className="num ml-1 text-muted">{wishes.filter((wish) => wish.effective === entry.id).length}</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {TABS.map((entry) => (
              <Tabs.Panel key={entry.id} id={entry.id} className="pt-3">
                <WishTable
                  wishes={wishes.filter((wish) => wish.effective === entry.id)}
                  empty={entry.empty}
                  today={lookups.today}
                  categoryName={new Map(lookups.categories.map((category) => [category.id, category.name]))}
                  onDialog={setDialog}
                  onStatus={(wish, status) => run(() => setWishStatus(wish.id, status))}
                  onUnplan={(wish) => run(() => unplanWish(wish.id))}
                />
              </Tabs.Panel>
            ))}
          </Tabs>

          {imports.length > 0 && (
            <Panel title="Importe">
              <ImportList imports={imports} noun={{ one: "Wunsch", many: "Wünsche" }} />
            </Panel>
          )}
        </div>
      )}

      {dialog?.kind === "edit" && <WishDialog key={dialog.wish?.id ?? "new"} wish={dialog.wish} onClose={close} />}
      {dialog?.kind === "plan" && <PlanDialog key={dialog.wish.id} wish={dialog.wish} onClose={close} />}
      {dialog?.kind === "bought" && <BoughtDialog key={dialog.wish.id} wish={dialog.wish} onClose={close} />}
      {dialog?.kind === "import" && <WishImportDialog isOpen onOpenChange={(open) => !open && close()} accounts={lookups.accounts} />}
      <ConfirmDialog
        isOpen={dialog?.kind === "delete"}
        onOpenChange={(open) => !open && close()}
        title="Wunsch löschen?"
        confirmLabel="Löschen"
        pending={pending}
        onConfirm={() => run(() => deleteWish(dialog?.kind === "delete" ? dialog.wish.id : ""))}
      >
        <p>
          „{dialog?.kind === "delete" ? dialog.wish.title : ""}“ wird endgültig gelöscht. Eine eingeplante, noch offene Zahlung verschwindet mit; bereits gebuchte
          Ausgaben bleiben.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/* --------------------------------- Tabelle --------------------------------- */

function WishTable({
  wishes,
  empty,
  today,
  categoryName,
  onDialog,
  onStatus,
  onUnplan,
}: {
  wishes: WishView[];
  empty: string;
  today: string;
  categoryName: Map<string, string>;
  onDialog: (dialog: Dialog) => void;
  onStatus: (wish: WishView, status: "dropped" | "idea") => Promise<boolean>;
  onUnplan: (wish: WishView) => Promise<boolean>;
}) {
  if (wishes.length === 0) return <Panel><p className="py-6 text-center text-muted">{empty}</p></Panel>;
  const total = wishes.reduce((sum, wish) => sum + wish.amountCents, 0);

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="label border-b border-separator">
            <th className="py-2 pl-4 pr-3 text-left font-medium sm:pl-5">Termin</th>
            <th className="py-2 text-left font-medium">Wunsch</th>
            <th className="py-2 text-right font-medium">Preis</th>
            <th className="py-2 pr-4 sm:pr-5">
              <span className="sr-only">Aktionen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {wishes.map((wish) => (
            <tr key={wish.id} className="border-b border-separator last:border-0">
              <td className="w-[96px] whitespace-nowrap py-2.5 pl-4 pr-2 align-top sm:pl-5 sm:pr-3">
                <DateCell wish={wish} today={today} />
              </td>
              <td className="py-2.5 pr-3 align-top">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="min-w-0 break-words">{wish.title}</span>
                  {wish.link && (
                    <a href={wish.link} target="_blank" rel="noopener noreferrer" aria-label={`${wish.title} im Shop öffnen`} className="shrink-0 text-muted hover:text-foreground">
                      <ArrowSquareOut className="size-3.5" />
                    </a>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted">
                  {wish.priority !== "normal" && (
                    <span className={wish.priority === "high" ? "text-warning" : ""}>{PRIORITY_LABEL[wish.priority]}</span>
                  )}
                  {wish.group && <span className="rounded bg-surface-secondary px-1.5">{wish.group}</span>}
                  {wish.categoryId && categoryName.get(wish.categoryId) && <span>{categoryName.get(wish.categoryId)}</span>}
                  {wish.note && <span className="max-w-[320px] truncate">{wish.note}</span>}
                </div>
              </td>
              <td className="whitespace-nowrap py-2.5 text-right align-top">
                <Money cents={wish.amountCents} tone="plain" />
              </td>
              <td className="py-2 pl-2 pr-3 align-top sm:pr-4">
                <WishActions wish={wish} onDialog={onDialog} onStatus={onStatus} onUnplan={onUnplan} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-separator">
            <td className="py-2 pl-4 sm:pl-5" />
            <td className="label py-2">Summe</td>
            <td className="py-2 text-right font-semibold">
              <Money cents={total} tone="plain" />
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function DateCell({ wish, today }: { wish: WishView; today: string }) {
  if (wish.effective === "planned" && wish.paymentDate) {
    const days = daysBetween(today, wish.paymentDate);
    return (
      <div>
        <div>{formatDayShort(wish.paymentDate)}</div>
        <Status tone={days < 0 ? "danger" : days <= 7 ? "warning" : "accent"}>
          {days < 0 ? `seit ${-days} ${-days === 1 ? "Tag" : "Tagen"}` : days === 0 ? "heute" : formatRelativeDays(days)}
        </Status>
      </div>
    );
  }
  if (wish.effective === "bought") return <span className="text-muted">{wish.paymentDate ? formatDayShort(wish.paymentDate) : "gekauft"}</span>;
  if (!wish.targetDate) return <span className="text-muted">offen</span>;
  return (
    <div>
      <div>{formatDayShort(wish.targetDate)}</div>
      <span className="label font-normal">frühestens</span>
    </div>
  );
}

function WishActions({
  wish,
  onDialog,
  onStatus,
  onUnplan,
}: {
  wish: WishView;
  onDialog: (dialog: Dialog) => void;
  onStatus: (wish: WishView, status: "dropped" | "idea") => Promise<boolean>;
  onUnplan: (wish: WishView) => Promise<boolean>;
}) {
  const open = wish.effective === "idea" || wish.effective === "planned";
  const items: Array<{ id: string; label: string }> = [];
  if (wish.effective === "idea") items.push({ id: "bought", label: "Gekauft …" });
  if (wish.effective === "planned") items.push({ id: "plan", label: "Termin ändern …" }, { id: "unplan", label: "Nicht mehr einplanen" });
  if (open) items.push({ id: "drop", label: "Verwerfen" });
  if (!open) items.push({ id: "reopen", label: "Wieder auf die Wunschliste" });
  items.push({ id: "edit", label: "Bearbeiten …" }, { id: "delete", label: "Löschen …" });

  return (
    <div className="flex items-center justify-end gap-1">
      {wish.effective === "idea" && (
        <Button size="sm" variant="secondary" className="h-7 px-2.5 text-[12.5px]" onPress={() => onDialog({ kind: "plan", wish })}>
          Einplanen
        </Button>
      )}
      {wish.effective === "planned" && (
        <Button size="sm" variant="secondary" className="h-7 px-2.5 text-[12.5px]" onPress={() => onDialog({ kind: "bought", wish })}>
          Gekauft
        </Button>
      )}
      <Dropdown>
        <Button size="sm" variant="ghost" isIconOnly aria-label={`Weitere Aktionen für ${wish.title}`} className="size-7 min-w-7">
          <DotsThreeVertical weight="bold" className="size-4" />
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            onAction={(key) => {
              if (key === "bought") onDialog({ kind: "bought", wish });
              if (key === "plan") onDialog({ kind: "plan", wish });
              if (key === "unplan") void onUnplan(wish);
              if (key === "drop") void onStatus(wish, "dropped");
              if (key === "reopen") void onStatus(wish, "idea");
              if (key === "edit") onDialog({ kind: "edit", wish });
              if (key === "delete") onDialog({ kind: "delete", wish });
            }}
          >
            {items.map((item) => (
              <Dropdown.Item key={item.id} id={item.id} textValue={item.label}>
                <Label>{item.label}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

/* --------------------------------- Dialoge --------------------------------- */

function useDialogState(onClose: () => void) {
  const [open, setOpen] = useState(true);
  return {
    isOpen: open,
    onOpenChange: (next: boolean) => {
      setOpen(next);
      if (!next) onClose();
    },
  };
}

function WishDialog({ wish, onClose }: { wish: WishView | null; onClose: () => void }) {
  const state = useDialogState(onClose);
  const { lookups } = useQuickAdd();
  const { run, pending } = useAction();
  const [title, setTitle] = useState(wish?.title ?? "");
  const [amount, setAmount] = useState(wish ? formatAmountInput(wish.amountCents) : "");
  const [targetDate, setTargetDate] = useState<string | null>(wish?.targetDate ?? null);
  const [priority, setPriority] = useState<WishPriority>(wish?.priority ?? "normal");
  const [group, setGroup] = useState(wish?.group ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(wish?.categoryId ?? null);
  const [link, setLink] = useState(wish?.link ?? "");
  const [note, setNote] = useState(wish?.note ?? "");
  const categories = lookups.categories.filter((category) => category.kind === "expense");

  return (
    <FormDialog
      {...state}
      title={wish ? "Wunsch bearbeiten" : "Wunsch hinzufügen"}
      description={wish?.effective === "planned" ? "Eingeplant – Preis und Bezeichnung werden in die geplante Zahlung übernommen." : undefined}
      pending={pending}
      onSubmit={() =>
        run(() => saveWish({ id: wish?.id ?? null, title, amount, targetDate, priority, group, categoryId, link, note }))
      }
    >
      <TextInput label="Was möchtest du kaufen?" value={title} onChange={setTitle} placeholder="z. B. Mikrofon" isRequired autoFocus maxLength={120} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Preis" value={amount} onChange={setAmount} />
        <DateInput label="Wunschtermin" value={targetDate} onChange={setTargetDate} description="Frühestens bzw. geplant für – leer = offen" />
      </div>
      <Segmented
        label="Priorität"
        value={priority}
        onChange={setPriority}
        options={[
          { id: "high", label: "Wichtig" },
          { id: "normal", label: "Normal" },
          { id: "low", label: "Später" },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput label="Gruppe / Sparziel" value={group} onChange={setGroup} placeholder="z. B. Streaming-Setup" maxLength={60} />
        <SelectInput
          label="Kategorie"
          value={categoryId}
          onChange={setCategoryId}
          placeholder="Ohne Kategorie"
          options={[{ id: "none", label: "Ohne Kategorie" }, ...categories.map((category) => ({ id: category.id, label: category.name }))]}
        />
      </div>
      <TextInput label="Link (optional)" value={link} onChange={setLink} placeholder="https://…" maxLength={500} />
      <NoteInput value={note} onChange={setNote} />
    </FormDialog>
  );
}

function PlanDialog({ wish, onClose }: { wish: WishView; onClose: () => void }) {
  const state = useDialogState(onClose);
  const { lookups } = useQuickAdd();
  const { run, pending } = useAction();
  const accounts = lookups.accounts.filter((account) => !account.archived);
  const fallbackDate = wish.targetDate && wish.targetDate > lookups.today ? wish.targetDate : lookups.today;
  const [date, setDate] = useState<string | null>(wish.paymentDate ?? fallbackDate);
  const [accountId, setAccountId] = useState<string | null>(
    wish.paymentAccountId ?? accounts.find((account) => account.kind === "giro")?.id ?? accounts[0]?.id ?? null,
  );
  const [amount, setAmount] = useState(formatAmountInput(wish.amountCents));

  return (
    <FormDialog
      {...state}
      title={wish.effective === "planned" ? `${wish.title}: Termin ändern` : `${wish.title} einplanen`}
      description="Wird als geplante Zahlung angelegt. Liegt der Termin im laufenden Monat, ist der Betrag ab sofort von „Aktuell verfügbar“ abgezogen."
      submitLabel={wish.effective === "planned" ? "Speichern" : "Einplanen"}
      pending={pending}
      onSubmit={() => run(() => planWish({ id: wish.id, date: date ?? "", accountId: accountId ?? "", amount }))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Betrag" value={amount} onChange={setAmount} autoFocus />
        <DateInput label="Kaufen am" value={date} onChange={setDate} isRequired />
      </div>
      <SelectInput label="Bezahlt von" value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ id: a.id, label: a.name }))} isRequired />
    </FormDialog>
  );
}

function BoughtDialog({ wish, onClose }: { wish: WishView; onClose: () => void }) {
  const state = useDialogState(onClose);
  const { lookups } = useQuickAdd();
  const { run, pending } = useAction();
  const accounts = lookups.accounts.filter((account) => !account.archived);
  const [book, setBook] = useState(true);
  const [amount, setAmount] = useState(formatAmountInput(wish.amountCents));
  const [date, setDate] = useState<string | null>(wish.paymentDate && wish.paymentDate < lookups.today ? wish.paymentDate : lookups.today);
  const [accountId, setAccountId] = useState<string | null>(
    wish.paymentAccountId ?? accounts.find((account) => account.kind === "giro")?.id ?? accounts[0]?.id ?? null,
  );

  return (
    <FormDialog
      {...state}
      title={`${wish.title}: gekauft`}
      submitLabel={book ? "Als Ausgabe buchen" : "Als gekauft markieren"}
      pending={pending}
      onSubmit={() => run(() => markWishBought({ id: wish.id, book, amount, date: date ?? "", accountId }))}
    >
      <Checkbox isSelected={book} onChange={setBook}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Ausgabe jetzt buchen
        </Checkbox.Content>
      </Checkbox>
      <p className="label -mt-2 font-normal">
        {book
          ? "Die Ausgabe ändert sofort den Kontostand."
          : "Nur als gekauft markieren – sinnvoll, wenn du die Umsätze per CSV von der Bank importierst. Sonst stünde die Ausgabe doppelt drin."}
      </p>
      {book && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyInput label="Tatsächlicher Preis" value={amount} onChange={setAmount} />
            <DateInput label="Gekauft am" value={date} onChange={setDate} isRequired />
          </div>
          <SelectInput label="Bezahlt von" value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ id: a.id, label: a.name }))} isRequired />
        </>
      )}
    </FormDialog>
  );
}
