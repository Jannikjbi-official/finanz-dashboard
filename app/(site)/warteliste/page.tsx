import { BRAND } from "@/lib/brand";
import { WaitlistForm } from "@/features/site/waitlist-form";

export const metadata = { title: "Warteliste" };

export default function WartelistePage() {
  return (
    <section className="mx-auto max-w-[640px] px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-accent">Geschlossene Beta</p>
      <h1 className="mt-3 font-serif text-[38px] leading-tight sm:text-[46px]">Platz auf der Warteliste</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
        {BRAND.name} wird gerade mit wenigen Menschen erprobt. Trag dich ein, dann bekommst du eine Einladung, sobald neue Plätze frei
        werden. Wir schreiben dir nur dafür – keine Newsletter, keine Werbung.
      </p>
      <WaitlistForm className="mt-10" />
    </section>
  );
}
