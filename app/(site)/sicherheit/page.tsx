import Link from "next/link";
import { Prose } from "@/features/site/prose";

export const metadata = { title: "Daten & Sicherheit" };

export default function SicherheitPage() {
  return (
    <Prose
      title="Daten & Sicherheit"
      intro="Finanzdaten sind persönlich. Deshalb speichern wir so wenig wie möglich – und schützen den Rest auf jeder Ebene."
    >
      <section>
        <h2>Keine Bankzugangsdaten</h2>
        <p>
          Wir verbinden uns nicht mit deiner Bank und fragen nie nach PIN, TAN oder Online-Banking-Zugang. Buchungen trägst du selbst ein
          oder importierst eine CSV-Datei, die du aus deinem Banking exportiert hast. Die Datei wird gelesen, nicht gespeichert.
        </p>
      </section>
      <section>
        <h2>Jede Abfrage ist an dein Konto gebunden</h2>
        <p>
          Die Trennung zwischen Nutzern passiert auf dem Server, nicht in der Oberfläche: Jede Datenbankabfrage enthält deine
          Nutzerkennung, und wer auf ein fremdes Konto oder eine fremde Kategorie verweist, wird abgewiesen. Automatische Tests prüfen
          das bei jeder Änderung.
        </p>
      </section>
      <section>
        <h2>Schutz vor Missbrauch</h2>
        <ul>
          <li>Passwörter werden nur als sicherer Hash gespeichert, mindestens 10 Zeichen.</li>
          <li>Anmeldeversuche, Schreibzugriffe, Importe und Exporte sind mengenbegrenzt.</li>
          <li>Sitzungen siehst und beendest du selbst unter „Anmeldung & Sicherheit“.</li>
          <li>Strenge Sicherheits-Header verhindern, dass die Seite in fremde Seiten eingebettet oder fremder Code geladen wird.</li>
        </ul>
      </section>
      <section>
        <h2>Kein Tracking, keine Werbung</h2>
        <p>
          Keine Analyse-Tools, keine Werbenetzwerke, keine Weitergabe an Dritte zu solchen Zwecken. Es gibt nur ein technisch nötiges
          Sitzungs-Cookie.
        </p>
      </section>
      <section>
        <h2>Deine Daten gehören dir</h2>
        <p>
          Vollständiger Export als JSON oder Buchungen als CSV – jederzeit, ohne Nachfrage. Und wenn du gehst, löschst du dein Konto mit
          allen Finanzdaten selbst, sofort und vollständig.
        </p>
      </section>
      <section>
        <h2>Planung, keine Beratung</h2>
        <p>
          Prognose, Sicherheitszone und Kaufcheck sind Rechnungen mit deinen Zahlen nach offengelegten Regeln. Wir empfehlen keine
          Finanzprodukte und verdienen nicht an deinen Entscheidungen.
        </p>
      </section>
      <p>
        Die rechtlichen Details stehen in der <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
    </Prose>
  );
}
