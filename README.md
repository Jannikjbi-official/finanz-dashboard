# Jannikjbi Finanzen

Private Finanzverwaltung. Beantwortet auf einen Blick: Wie viel Geld habe ich,
wie viel davon ist wirklich verfügbar, was steht als Nächstes an, was kosten
Abos und feste Kosten – und was bleibt am Monatsende übrig.

Next.js 15 (App Router) · React 19 · HeroUI v3 · Tailwind 4 · Better Auth · MongoDB · Vitest

## Schnellstart (lokal)

```bash
npm install
cp .env.example .env          # BETTER_AUTH_SECRET und ALLOWED_EMAILS setzen
npm run dev:db                # lokale MongoDB ohne Installation (eigenes Terminal)
npm run dev                   # http://localhost:3000 → „Zugang einrichten“
```

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` / `build` / `start` | Entwicklung, Produktions-Build, Start |
| `npm run typecheck` | TypeScript prüfen |
| `npm test` | Finanzlogik, Import, Migrationen und Server Actions (gegen MongoDB im Speicher) |
| `npm run check` | Typen, Tests und Build in einem Schritt |
| `npm run dev:db` | Lokale MongoDB auf Port 27017, Daten in `.devdb/` |
| `npm run db:backup` | Alle Collections als Extended JSON nach `backups/` |
| `npm run db:restore -- <ordner> [--replace]` | Sicherung zurückspielen (mit `--replace` wird vorher gesichert) |
| `npm run db:migrate [-- --dry-run]` | Ausstehende Migrationen (sichert vorher automatisch) |

## Umstieg von der Vorversion („Spielraum“)

Die bestehenden Daten bleiben vollständig erhalten. Die neue Version liest alte
Datensätze direkt (fehlende Felder bekommen beim Lesen Standardwerte), es muss
also nichts umgeschrieben werden, damit die App funktioniert.

Empfohlen vor bzw. nach dem ersten Deploy:

1. Sicherung ziehen: Atlas-Snapshot **und** `npm run db:backup` mit der Produktions-`MONGODB_URI`.
2. `npm run db:migrate -- --dry-run` – zeigt, was passieren würde.
3. `npm run db:migrate` – nur ergänzend, es wird nichts gelöscht:
   - **005** übernimmt offene „geplante/erwartete“ Posten als offene Buchungen
     (Posten ohne Termin werden nicht eingeplant, das Original bleibt).
   - **006** speichert Status und Kostenart der regelmäßigen Zahlungen
     (das alte Feld `active` bleibt).

Nicht mehr genutzte Collections (`goals`, `scenarios`, `refunds`, `planned`,
`beta_invites`, `waitlist`) werden nicht angefasst und sind weiter im
JSON-Export enthalten. Der Code der Vorversion steht in der Git-Historie
(Commit `413ec52`).

Alte Adressen funktionieren weiter. Achtung: Die Vorversion hat u. a.
`/transaktionen` und `/konten` **permanent** auf `/app/...` umgeleitet; Browser
merken sich das. Diese `/app/...`-Pfade werden deshalb intern umgeschrieben
statt umgeleitet (`next.config.mjs`), sonst entstünde eine Schleife.

## Aufbau

```
app/(app)/           Übersicht, Transaktionen, Abonnements, Feste Kosten, Konten, Einstellungen
app/(auth)/          Anmelden, Zugang einrichten
app/api/             Better Auth, CSV-/JSON-Export
components/          Oberfläche (HeroUI v3), Diagramme (eigenes SVG), Dialoge
lib/domain/          Reine, getestete Finanzlogik – keine Datenbank, keine UI
lib/server/          Datenbank, Auth, Server Actions (Zod-Validierung, Rate Limit), Migrationen
docs/DESIGNSYSTEM.md Farben, Typografie, Abstände, Komponenten, Diagramme
```

## Rechenregeln

- **Beträge** sind ganzzahlige Cent. „Heute“ richtet sich nach der Zeitzone in den Einstellungen.
- **Kontostand** = Anfangssaldo + gebuchte Bewegungen. Geplante Ausgaben und erwartete Einnahmen ändern ihn nicht.
- **Aktuell verfügbar** = Kontostand der Konten, die zum verfügbaren Geld zählen
  − fällige, unbezahlte Zahlungen − bis Monatsende geplante Ausgaben.
  Erwartete Einnahmen zählen nicht; sie fließen nur in die Prognose für den Monatsletzten.
- **Regelmäßige Zahlungen**: Jeder Termin vor `nextDue` ist erledigt (bezahlt oder
  übersprungen), ab `nextDue` offen. „Bezahlt“ erzeugt genau eine Buchung und rückt
  den Termin weiter – die Aktualisierung ist an den erwarteten Termin gebunden, ein
  doppelter Klick bucht nicht doppelt. Monatsenden und Schaltjahre bleiben am Ankertag (31. → 28./29. → 31.).
- **Monats-/Jahreswerte** sind Vergleichswerte (120 €/Jahr = 10 €/Monat).
  Tatsächliche Abbuchungen kommen nur aus den Terminen.
- **Pausiert / gekündigt** planen nichts mehr ein – außer bei gekündigten Verträgen mit Vertragsende.
- **Transfers** sind zwei verknüpfte Buchungen, ändern beide Kontostände und zählen nie als Einnahme oder Ausgabe.

## Sicherheit

- Registrierung nur für Adressen aus `ALLOWED_EMAILS`.
- Jede Abfrage und jede Server Action ist an die `userId` der Sitzung gebunden;
  referenzierte Konten/Kategorien werden auf Eigentum geprüft (getestet).
- Serverseitige Validierung mit Zod, Rate Limits in MongoDB, CSP und weitere Sicherheits-Header,
  CSV-Export gegen Formel-Injection entschärft, keine Telemetrie, keine Secrets im Client.
