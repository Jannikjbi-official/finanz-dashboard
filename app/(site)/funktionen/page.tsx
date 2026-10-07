import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { buttonClass } from "@/ui/button";

export const metadata = { title: "Funktionen" };

const AREAS = [
  {
    id: "lage",
    name: "Lage",
    question: "Wie steht es gerade – und was sollte ich wissen?",
    points: [
      "Verfügbares Geld über alle Konten, Rücklagen getrennt",
      "Sicherheitszone in vier Stufen, jeweils mit Begründung",
      "Spielraum: was du heute ausgeben kannst, ohne in 90 Tagen unter die Reserve zu fallen",
      "Zeitachse: 60 Tage zurück, 90 Tage voraus, mit Tiefpunkt",
      "Hinweise zu Budgets, Ausreißern, Zielen und fälligen Zahlungen",
    ],
  },
  {
    id: "geld",
    name: "Geld",
    question: "Wo ist mein Geld, was ist passiert?",
    points: [
      "Konten mit Startsaldo; Umbuchungen zählen nie als Einnahme oder Ausgabe",
      "Buchungen mit Suche und Filtern; Datum darf unscharf sein (Zeitraum oder ganzer Monat)",
      "CSV-Import mit Spaltenzuordnung, Bankformaten, Fehleranzeige und Dublettenerkennung",
    ],
  },
  {
    id: "planung",
    name: "Planung",
    question: "Was steht an?",
    points: [
      "Finanzkalender: Gebuchtes, Erwartetes und der voraussichtliche Stand jedes Tages",
      "Fixkosten mit Monats-, Jahres- und Fünf-Jahres-Summe",
      "Budgets mit Hochrechnung bis Monatsende",
      "Geplante Ausgaben und erwartete Einnahmen – auch ohne festen Termin",
      "Sparziele mit Rate, erwartetem Erreichen und nötiger Rate für die Frist",
    ],
  },
  {
    id: "entscheiden",
    name: "Entscheiden",
    question: "Kann ich mir das leisten? Was wäre, wenn …?",
    points: [
      "Kaufcheck: Stand vorher und nachher, Tiefpunkt, Reserve, Auswirkung auf Ziele, Erholungszeit – auch in Raten",
      "Sandbox: einmalige oder monatliche Ereignisse durchspielen und als Szenario speichern",
      "Beides rechnet gegen deine echte Prognose und verändert nie deine Daten",
    ],
  },
  {
    id: "rueckblick",
    name: "Rückblick",
    question: "Wie hat es sich entwickelt?",
    points: [
      "Monatsbericht mit Sparquote, größten Posten, Ausreißern und Vergleich zum Vormonat",
      "Analysen über zwölf Monate und Kategorien im Verlauf",
      "Zeitreise: Kontostände und Monatszahlen zu einem beliebigen Stichtag",
    ],
  },
];

export default function FunktionenPage() {
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-14 sm:px-8 sm:py-20">
      <h1 className="max-w-3xl font-serif text-[38px] leading-tight sm:text-[48px]">Fünf Bereiche, sortiert nach den Fragen, die du an dein Geld stellst.</h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2">
        {BRAND.name} ist kein Haushaltsbuch mit Diagrammen. Alles hängt an einer gemeinsamen Prognose – deshalb passen Lage, Kalender,
        Kaufcheck und Sandbox immer zusammen.
      </p>

      <div className="mt-16 flex flex-col">
        {AREAS.map((area, index) => (
          <section key={area.id} id={area.id} className="grid scroll-mt-24 gap-6 border-t border-ink py-10 md:grid-cols-[14rem_1fr]">
            <div>
              <p className="num text-[13px] text-ink-3">0{index + 1}</p>
              <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">{area.name}</h2>
            </div>
            <div>
              <p className="font-serif text-[22px] leading-snug">{area.question}</p>
              <ul className="mt-4 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-2">
                {area.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-ink-3" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-ink pt-8">
        <Link href="/warteliste" className={buttonClass("primary", "md", "h-11 px-5")}>
          Auf die Warteliste
        </Link>
        <Link href="/sicherheit" className="text-[15px] text-accent hover:underline">
          Wie wir mit deinen Daten umgehen →
        </Link>
      </div>
    </div>
  );
}
