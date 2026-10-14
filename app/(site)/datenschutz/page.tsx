import { DraftNotice, Prose } from "@/components/site/site-links";
import { operator } from "@/lib/legal";

export const metadata = { title: "Datenschutz" };
export const dynamic = "force-dynamic";

export default function DatenschutzPage() {
  const legal = operator();
  return (
    <Prose title="Datenschutzerklärung">
      {!legal.complete && <DraftNotice>Die Angaben zum Verantwortlichen fehlen noch (LEGAL_* in der Umgebung setzen).</DraftNotice>}

      <h2>Verantwortlicher</h2>
      <p>
        {legal.name ?? "–"}, {legal.street ?? "–"}, {legal.city ?? "–"}, E-Mail: {legal.email ? <a href={`mailto:${legal.email}`}>{legal.email}</a> : "–"}
      </p>

      <h2>Besuch der Website</h2>
      <p>
        Beim Aufruf verarbeitet der Hosting-Anbieter Vercel Inc. technisch notwendige Verbindungsdaten (IP-Adresse, Zeitpunkt, aufgerufene Adresse,
        Browserkennung), um die Seite auszuliefern und vor Missbrauch zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Es gibt keine Analyse- oder
        Werbedienste, kein Tracking und keine Einbindung von Inhalten Dritter.
      </p>

      <h2>Konto und Anmeldung</h2>
      <p>
        Der Zugang ist auf freigegebene E-Mail-Adressen beschränkt. Gespeichert werden Name, E-Mail-Adresse, ein gehashtes Passwort, optional
        Daten zur Zwei-Faktor-Anmeldung sowie je Sitzung Zeitpunkt, IP-Adresse und Browserkennung (angezeigt unter Einstellungen → Sicherheit).
        Für die Anmeldung werden technisch notwendige Cookies gesetzt (Art. 6 Abs. 1 lit. b DSGVO). Das Farbschema wird nur im Browser gespeichert.
      </p>
      <p>
        Wer sich mit Discord anmeldet, wird zu Discord Inc. weitergeleitet; dabei erhält die Anwendung Name und E-Mail-Adresse des Discord-Kontos.
      </p>

      <h2>Finanzdaten</h2>
      <p>
        Konten, Buchungen, regelmäßige Zahlungen, Wünsche und importierte CSV-Dateien werden in der Datenbank der Anwendung (MongoDB) gespeichert –
        ausschließlich, um sie dir anzuzeigen und zu berechnen. Es werden keine Bankzugangsdaten erhoben. Auf dem Gerät werden keine Finanzdaten
        zwischengespeichert.
      </p>
      <p>
        Benachrichtigungen per Discord werden nur verschickt, wenn du selbst einen Webhook einträgst; dann gehen die Texte (z. B. Bezeichnung und
        Betrag fälliger Zahlungen) an Discord.
      </p>

      <h2>Speicherdauer</h2>
      <p>
        Daten bleiben gespeichert, bis du sie löschst oder die Löschung des Kontos verlangst. Sitzungen enden nach 7 Tagen ohne Nutzung.
      </p>

      <h2>Deine Rechte</h2>
      <ul>
        <li>Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung (Art. 15–18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO) – unter Einstellungen → Daten als vollständige JSON-Sicherung</li>
        <li>Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO)</li>
        <li>Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO)</li>
      </ul>
    </Prose>
  );
}
