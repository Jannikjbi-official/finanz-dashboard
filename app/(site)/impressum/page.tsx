import { DraftNotice, Prose } from "@/components/site/site-links";
import { operator } from "@/lib/legal";

export const metadata = { title: "Impressum" };
export const dynamic = "force-dynamic";

export default function ImpressumPage() {
  const legal = operator();
  return (
    <Prose title="Impressum">
      {!legal.complete && (
        <DraftNotice>Die Anbieterangaben fehlen noch. Für Betreiber: LEGAL_NAME, LEGAL_STREET, LEGAL_CITY und LEGAL_EMAIL in der Umgebung setzen.</DraftNotice>
      )}
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        {legal.name ?? "–"}
        <br />
        {legal.street ?? "–"}
        <br />
        {legal.city ?? "–"}
      </p>
      <h2>Kontakt</h2>
      <p>E-Mail: {legal.email ? <a href={`mailto:${legal.email}`}>{legal.email}</a> : "–"}</p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>{legal.name ?? "–"}, Anschrift wie oben.</p>
      <h2>Hinweis</h2>
      <p>
        Diese Anwendung ist ein Werkzeug zur persönlichen Finanzverwaltung. Sie erbringt keine Anlage-, Steuer- oder Finanzberatung; alle
        Berechnungen beruhen ausschließlich auf den eingegebenen Daten.
      </p>
    </Prose>
  );
}
