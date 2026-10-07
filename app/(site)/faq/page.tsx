import { BRAND } from "@/lib/brand";
import { Prose } from "@/features/site/prose";

export const metadata = { title: "Fragen" };

const FAQ = [
  {
    q: `Was kostet ${BRAND.name}?`,
    a: "Nichts. Die Plattform ist kostenlos und finanziert sich nicht über Werbung oder Datenverkauf.",
  },
  {
    q: "Wann kann ich mitmachen?",
    a: "Gerade läuft eine geschlossene Beta. Trag dich auf die Warteliste ein – du bekommst eine Einladung, sobald neue Plätze frei sind.",
  },
  {
    q: "Muss ich mein Bankkonto verbinden?",
    a: "Nein, und das ist Absicht. Du trägst Buchungen ein oder importierst eine CSV-Datei aus deinem Online-Banking. Zugangsdaten zu deiner Bank brauchen wir nie.",
  },
  {
    q: "Wie genau ist die Prognose?",
    a: "So genau wie deine Angaben. Sie rechnet mit deinen Fixkosten an ihren echten Terminen, geplanten Ausgaben, erwarteten Einnahmen, Sparraten und dem Durchschnitt deiner variablen Ausgaben – bewusst vorsichtig: Ausgaben möglichst früh, unsichere Einnahmen möglichst spät.",
  },
  {
    q: "Was bedeutet die Sicherheitszone?",
    a: "Eine Einstufung in vier Stufen – stabil, angespannt, kritisch, unter Mindestreserve – nach festen Regeln, die in der App erklärt sind. Es gibt keine geheime Bewertung.",
  },
  {
    q: "Ist das eine Finanzberatung?",
    a: "Nein. Die App rechnet mit deinen eigenen Zahlen und zeigt Folgen. Sie empfiehlt keine Produkte und ersetzt keine Anlage-, Steuer- oder Finanzberatung.",
  },
  {
    q: "Was passiert in der Sandbox mit meinen Daten?",
    a: "Nichts. Die Sandbox rechnet nur mit. Gespeichert wird höchstens das Szenario selbst, wenn du es speicherst – nie eine Buchung.",
  },
  {
    q: "Kann ich meine Daten mitnehmen oder löschen?",
    a: "Ja, jederzeit selbst: vollständiger Export als JSON, Buchungen als CSV, und Löschung des Kontos mit allen Daten unter Einstellungen → Daten & Datenschutz.",
  },
  {
    q: "Funktioniert das auf dem Handy?",
    a: "Ja. Die Oberfläche ist für Handy, Tablet und Desktop gebaut – mit eigener Navigation unten auf kleinen Bildschirmen.",
  },
];

export default function FaqPage() {
  return (
    <Prose title="Fragen und Antworten">
      <dl className="flex flex-col">
        {FAQ.map((item) => (
          <div key={item.q} className="border-t border-line py-5">
            <dt className="text-[17px] font-semibold text-ink">{item.q}</dt>
            <dd className="mt-2">{item.a}</dd>
          </div>
        ))}
      </dl>
    </Prose>
  );
}
