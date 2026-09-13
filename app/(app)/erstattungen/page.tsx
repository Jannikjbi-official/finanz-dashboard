import { requireUser } from "@/lib/session";
import { getAccounts, getCategories, getRefunds } from "@/lib/queries";
import { daysUntil } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { RefundDialog } from "@/components/refund-dialog";
import { RefundList } from "@/components/refund-list";
import { PageHeader, SectionCard, StatCard } from "@/components/ui";

export default async function RefundsPage() {
  const user = await requireUser();
  const [refunds, categories, accounts] = await Promise.all([
    getRefunds(user.id),
    getCategories(user.id),
    getAccounts(user.id),
  ]);

  const open = refunds.filter((refund) => refund.status === "open");
  const received = refunds.filter((refund) => refund.status === "received");

  const openTotal = open.reduce((sum, refund) => sum + refund.amountCents, 0);
  const receivedTotal = received.reduce(
    (sum, refund) => sum + refund.amountCents,
    0,
  );

  const unknown = open.filter((refund) => !refund.expectedFrom).length;
  const overdue = open.filter(
    (refund) =>
      refund.expectedFrom &&
      daysUntil(refund.expectedTo ?? refund.expectedFrom) < 0,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Erstattungen"
        description="Geld, das dir noch zurückgezahlt wird – auch wenn der Zeitpunkt offen ist."
        actions={<RefundDialog categories={categories} accounts={accounts} />}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Offen"
          value={formatMoney(openTotal)}
          hint={`${open.length} ${open.length === 1 ? "Erstattung" : "Erstattungen"}`}
          tone="success"
        />
        <StatCard
          label="Ohne Termin"
          value={`${unknown}`}
          hint={
            unknown > 0
              ? "Zeitpunkt noch unbekannt"
              : "bei allen ist ein Termin hinterlegt"
          }
        />
        <StatCard
          label="Überfällig"
          value={`${overdue}`}
          hint={overdue > 0 ? "erwarteter Termin ist durch" : "nichts überfällig"}
          tone={overdue > 0 ? "warning" : "muted"}
        />
      </section>

      <SectionCard
        title="Offene Erstattungen"
        description={'"Erhalten" bucht den Betrag als Einnahme – der tatsächliche Betrag lässt sich dabei anpassen.'}
      >
        <RefundList
          refunds={open}
          categories={categories}
          accounts={accounts}
        />
      </SectionCard>

      {received.length > 0 ? (
        <SectionCard
          title="Bereits erhalten"
          description={`${received.length} · insgesamt ${formatMoney(receivedTotal)}`}
        >
          <RefundList
            refunds={received}
            categories={categories}
            accounts={accounts}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
