import { legalReviewed, operator } from "@/lib/legal";
import { BRAND } from "@/lib/brand";
import { DraftNotice, Prose } from "@/features/site/prose";

export const metadata = { title: "Datenschutz" };

export default function DatenschutzPage() {
  const legal = operator();

  return (
    <Prose
      title="Datenschutz"
      intro={`${BRAND.name} verarbeitet nur, was für die Funktion nötig ist. Kein Tracking, keine Werbung, keine Weitergabe zu Werbe- oder Analysezwecken.`}
    >
      {!legalReviewed() ? <DraftNotice>Entwurf – diese Datenschutzerklärung wird vor dem öffentlichen Start rechtlich geprüft.</DraftNotice> : null}

      <section>
        <h2>1. Verantwortlicher</h2>
        <p>
          {legal.name ?? "Anbieter siehe Impressum"}
          {legal.street ? (
            <>
              <br />
              {legal.street}
              <br />
              {legal.city}
            </>
          ) : null}
          <br />
          E-Mail: {legal.email ? <a href={`mailto:${legal.email}`}>{legal.email}</a> : "siehe Impressum"}
        </p>
      </section>

      <section>
        <h2>2. Welche Daten wir verarbeiten</h2>
        <ul>
          <li>
            <strong>Konto:</strong> E-Mail-Adresse, Name, Passwort (nur als sicherer Hash), bei Anmeldung über Discord die von Discord
            übermittelte ID, E-Mail und Name.
          </li>
          <li>
            <strong>Sitzungen:</strong> Sitzungskennung, Zeitpunkt, IP-Adresse und Browserkennung, um angemeldete Geräte anzuzeigen und
            Missbrauch zu verhindern.
          </li>
          <li>
            <strong>Finanzdaten, die du selbst einträgst oder importierst:</strong> Konten und Startsalden, Buchungen, Kategorien,
            Fixkosten, geplante Posten, Sparziele, Szenarien und Einstellungen. Wir verbinden uns nie mit deiner Bank.
          </li>
          <li>
            <strong>Warteliste:</strong> E-Mail-Adresse, optional Name, Zeitpunkt deiner Einwilligung.
          </li>
          <li>
            <strong>Schutz vor Missbrauch:</strong> zeitlich begrenzte Zähler pro Konto oder IP-Adresse (Rate Limiting), die automatisch
            gelöscht werden.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Zwecke und Rechtsgrundlagen</h2>
        <ul>
          <li>Bereitstellung der Plattform und deines Kontos – Art. 6 Abs. 1 lit. b DSGVO (Vertrag).</li>
          <li>Warteliste – Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), jederzeit widerrufbar.</li>
          <li>Sicherheit, Missbrauchsabwehr, Rate Limiting – Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Betrieb).</li>
        </ul>
      </section>

      <section>
        <h2>4. Cookies und lokale Speicherung</h2>
        <p>
          Wir setzen ausschließlich ein technisch notwendiges Sitzungs-Cookie, damit du angemeldet bleibst. Deine Wahl zwischen hellem und
          dunklem Design wird nur in deinem Browser gespeichert (localStorage). Es gibt keine Analyse-, Marketing- oder Drittanbieter-Cookies;
          deshalb gibt es auch keinen Cookie-Banner.
        </p>
      </section>

      <section>
        <h2>5. Hosting und Auftragsverarbeitung</h2>
        <p>
          Die Anwendung und die Datenbank werden bei spezialisierten Hosting-Dienstleistern betrieben, mit denen Verträge zur
          Auftragsverarbeitung nach Art. 28 DSGVO bestehen. Soweit dabei Daten in Staaten außerhalb der EU verarbeitet werden können,
          erfolgt dies auf Grundlage geeigneter Garantien (z. B. EU-Standardvertragsklauseln oder Angemessenheitsbeschluss).
        </p>
      </section>

      <section>
        <h2>6. Speicherdauer</h2>
        <ul>
          <li>Konto- und Finanzdaten: bis du dein Konto löschst. Die Löschung entfernt alle Finanzdaten sofort.</li>
          <li>Warteliste: bis zum Start der Plattform für dich oder bis zu deinem Widerruf.</li>
          <li>Sitzungen: höchstens 30 Tage nach der letzten Aktivität.</li>
          <li>Rate-Limit-Zähler: wenige Minuten bis höchstens eine Stunde.</li>
        </ul>
      </section>

      <section>
        <h2>7. Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch
          (Art. 15–21 DSGVO) sowie auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO). Export und Löschung kannst du
          jederzeit selbst unter Einstellungen → Daten & Datenschutz auslösen.
        </p>
      </section>

      <section>
        <h2>8. Keine automatisierten Entscheidungen</h2>
        <p>
          Prognosen, die Sicherheitszone und der Kaufcheck sind Berechnungen aus deinen eigenen Angaben nach offen beschriebenen Regeln.
          Es findet keine automatisierte Entscheidung mit rechtlicher Wirkung und kein Profiling zu Werbezwecken statt.
        </p>
      </section>
    </Prose>
  );
}
