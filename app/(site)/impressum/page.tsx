import { operator } from "@/lib/legal";
import { DraftNotice, Prose } from "@/features/site/prose";

export const metadata = { title: "Impressum" };

export default function ImpressumPage() {
  const legal = operator();

  return (
    <Prose title="Impressum">
      {!legal.complete ? (
        <DraftNotice>
          Die Anbieterangaben werden vor dem öffentlichen Start ergänzt. (Für Betreiber: LEGAL_NAME, LEGAL_STREET, LEGAL_CITY und
          LEGAL_EMAIL in der Umgebung setzen.)
        </DraftNotice>
      ) : null}
      <section>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          {legal.name ?? "–"}
          <br />
          {legal.street ?? "–"}
          <br />
          {legal.city ?? "–"}
        </p>
      </section>
      <section>
        <h2>Kontakt</h2>
        <p>E-Mail: {legal.email ? <a href={`mailto:${legal.email}`}>{legal.email}</a> : "–"}</p>
      </section>
      <section>
        <h2>Verantwortlich für den Inhalt</h2>
        <p>{legal.name ?? "–"}, Anschrift wie oben.</p>
      </section>
      <section>
        <h2>Hinweis</h2>
        <p>
          Die Plattform ist ein Werkzeug zur persönlichen Finanzplanung. Sie erbringt keine Anlage-, Steuer- oder Finanzberatung; alle
          Berechnungen beruhen ausschließlich auf den Angaben der Nutzerinnen und Nutzer.
        </p>
      </section>
    </Prose>
  );
}
