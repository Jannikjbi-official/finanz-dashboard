import { requireUser } from "@/lib/session";
import { loadFinancialPicture } from "@/lib/server/finance";
import { CUSHION_RATIO, FAR_WINDOW, NEAR_WINDOW, SAFETY_LABEL } from "@/lib/domain/safety";
import { formatMoney } from "@/lib/format";
import { PageHeader, Section } from "@/ui/layout";
import { SafetyScale } from "@/ui/safety";
import { ProfileForm, ReserveForm, TimeZoneForm, VariableEstimateForm } from "@/features/settings/general-form";

export const metadata = { title: "Einstellungen" };

export default async function EinstellungenPage() {
  const user = await requireUser();
  const picture = await loadFinancialPicture(user.id);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title="Einstellungen" description={user.email} />

      <Section title="Profil">
        <ProfileForm name={user.name} />
      </Section>

      <Section id="reserve" title="Mindestreserve und Sicherheitszone">
        <div className="flex flex-col gap-6">
          <ReserveForm reserveCents={picture.settings.reserveCents} fixedMonthlyCents={picture.monthly.fixedCents} />

          <div className="border-t border-line pt-5">
            <p className="text-[13px] text-ink-3">Aktuell</p>
            <SafetyScale level={picture.safety.level} className="mt-1" />
            <h3 className="mt-5 text-[14px] font-semibold">So entsteht die Einstufung</h3>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[11rem_1fr]">
              <dt className="font-medium">{SAFETY_LABEL.below}</dt>
              <dd className="text-ink-2">Dein verfügbares Geld liegt schon heute unter der Reserve.</dd>
              <dt className="font-medium">{SAFETY_LABEL.critical}</dt>
              <dd className="text-ink-2">Laut Prognose fällt es in den nächsten {NEAR_WINDOW} Tagen darunter.</dd>
              <dt className="font-medium">{SAFETY_LABEL.tight}</dt>
              <dd className="text-ink-2">
                Es fällt in {NEAR_WINDOW + 1}–{FAR_WINDOW} Tagen darunter, oder der tiefste Stand der nächsten {NEAR_WINDOW} Tage liegt weniger als{" "}
                {Math.round(CUSHION_RATIO * 100)} % über der Reserve.
              </dd>
              <dt className="font-medium">{SAFETY_LABEL.stable}</dt>
              <dd className="text-ink-2">Nichts davon trifft zu.</dd>
            </dl>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
              Grundlage ist die Prognose aus deinen verfügbaren Konten, Fixkosten, geplanten Ausgaben, erwarteten Einnahmen (vorsichtig
              gerechnet), Sparraten und dem Durchschnitt deiner variablen Ausgaben ({formatMoney(picture.monthly.variableCents, { whole: true })}/Monat
              aus {picture.monthly.variableBasisMonths} Monaten). Es gibt keine verborgene Bewertung.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Prognose">
        <VariableEstimateForm estimateCents={picture.settings.variableEstimateCents ?? null} basisMonths={picture.monthly.variableBasisMonths} />
      </Section>

      <Section title="Region">
        <TimeZoneForm timeZone={picture.settings.timeZone} />
        <p className="mt-3 text-[13px] text-ink-3">Währung: Euro. Weitere Währungen sind noch nicht verfügbar.</p>
      </Section>
    </div>
  );
}
