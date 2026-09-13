import { requireUser } from "@/lib/session";
import { getCategories, getRecurring } from "@/lib/queries";
import { monthlyAmount } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/money";
import { CategoryBars } from "@/components/charts";
import { RecurringDialog } from "@/components/recurring-dialog";
import { DueChip, RecurringList } from "@/components/recurring-list";
import { PageHeader, SectionCard, StatCard } from "@/components/ui";

export default async function SubscriptionsPage() {
  const user = await requireUser();
  const [categories, entries] = await Promise.all([
    getCategories(user.id),
    getRecurring(user.id),
  ]);

  const byId = new Map(categories.map((category) => [category.id, category]));

  // Abos sind ausschliesslich Ausgaben - feste Einnahmen leben im Dashboard.
  const abos = entries.filter((entry) => entry.type === "expense");
  const active = abos.filter((entry) => entry.active);

  const monthly = active.reduce(
    (sum, entry) => sum + monthlyAmount(entry.amountCents, entry.interval),
    0,
  );

  const nextDue = [...active].sort((a, b) =>
    a.nextDue.localeCompare(b.nextDue),
  )[0];

  const priciest = [...active].sort(
    (a, b) =>
      monthlyAmount(b.amountCents, b.interval) -
      monthlyAmount(a.amountCents, a.interval),
  )[0];

  const buckets = new Map<string, number>();
  for (const entry of active) {
    const key = entry.categoryId ?? "none";
    buckets.set(
      key,
      (buckets.get(key) ?? 0) + monthlyAmount(entry.amountCents, entry.interval),
    );
  }

  const slices = [...buckets.entries()]
    .map(([key, amountCents]) => {
      const category = key === "none" ? undefined : byId.get(key);
      return {
        name: category?.name ?? "Ohne Kategorie",
        color: category?.color ?? "#64748b",
        icon: category?.icon ?? "",
        amountCents,
      };
    })
    .sort((a, b) => b.amountCents - a.amountCents);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Abos"
        description="Alle regelmäßigen Ausgaben, auf Monat und Jahr gerechnet."
        actions={
          <>
            <DueChip entries={abos} />
            <RecurringDialog categories={categories} lockType="expense" />
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pro Monat"
          value={formatMoney(monthly)}
          hint={`${active.length} aktive Abos`}
          tone="danger"
        />
        <StatCard
          label="Pro Jahr"
          value={formatMoney(monthly * 12)}
          hint="hochgerechnet"
          tone="danger"
        />
        <StatCard
          label="Nächste Zahlung"
          value={nextDue ? formatDate(nextDue.nextDue) : "–"}
          hint={nextDue ? nextDue.title : "keine aktiven Abos"}
        />
        <StatCard
          label="Teuerstes Abo"
          value={
            priciest
              ? formatMoney(monthlyAmount(priciest.amountCents, priciest.interval))
              : "–"
          }
          hint={priciest ? `${priciest.title} pro Monat` : "keine aktiven Abos"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Alle Abos"
          description={`${abos.length} Einträge`}
          className="lg:col-span-2"
        >
          <RecurringList
            entries={abos}
            categories={categories}
            lockType="expense"
            emptyTitle="Noch keine Abos angelegt."
            emptyHint="Lege Spotify, Handyvertrag oder Miete an – die Kosten werden automatisch hochgerechnet."
          />
        </SectionCard>

        <SectionCard title="Nach Kategorie" description="Monatliche Abo-Kosten">
          <CategoryBars slices={slices} total={monthly} />
        </SectionCard>
      </section>
    </div>
  );
}
