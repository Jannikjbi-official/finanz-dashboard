# Finanz Dashboard

Privates Finanz-Dashboard: Einnahmen, Ausgaben, eigene Kategorien und Abos.
Next.js 15 (App Router) · HeroUI · Better Auth (E-Mail + Discord) · MongoDB.

## Schnellstart

```bash
npm install
npm run dev
```

Läuft dann auf http://localhost:3000

## Konfiguration (`.env`)

| Variable | Bedeutung |
| --- | --- |
| `BETTER_AUTH_URL` | Basis-URL der App (z. B. `http://localhost:3000`) |
| `BETTER_AUTH_SECRET` | Zufälliges Secret für Sessions (ist bereits generiert) |
| `MONGODB_URI` | Verbindungsstring, lokal oder MongoDB Atlas |
| `MONGODB_DB` | Datenbankname (Standard `finanz`) |
| `ALLOWED_EMAILS` | **Zugangssperre** – nur diese Adressen dürfen ein Konto anlegen, mit Komma getrennt |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord-Login (optional; ohne Werte wird der Button ausgeblendet) |
| `BETTER_AUTH_API_KEY` | Key für das Better-Auth-Infra-Plugin (Dashboard/Analytics) |
| `NEXT_PUBLIC_BETTER_AUTH_IDENTIFY_URL` | Projekt-Ingestion-URL von Sentinel. Muss das `NEXT_PUBLIC_`-Präfix haben, weil sie im Browser gebraucht wird |

### Discord einrichten

1. https://discord.com/developers/applications → New Application
2. OAuth2 → Redirects hinzufügen, **beide** eintragen:
   - `http://localhost:3000/api/auth/callback/discord`
   - `https://finanzen.jannikjbi.de/api/auth/callback/discord`
3. Client ID und Client Secret in die `.env` eintragen, Server neu starten.

Wichtig: Die Discord-Mailadresse muss ebenfalls in `ALLOWED_EMAILS` stehen,
sonst wird der Login abgelehnt.

## Deployment auf Vercel (finanzen.jannikjbi.de)

1. Repo in Vercel importieren (Framework wird als Next.js erkannt, kein Build-Override nötig).
2. MongoDB über *Storage → Marketplace → MongoDB Atlas* anbinden. Vercel legt
   dabei die Verbindungsvariable an – heißt sie nicht `MONGODB_URI`, dann in den
   Projekt-Settings eine Variable `MONGODB_URI` mit demselben Wert ergänzen.
3. Environment Variables für **Production** setzen:

   | Variable | Wert |
   | --- | --- |
   | `BETTER_AUTH_URL` | `https://finanzen.jannikjbi.de` |
   | `NEXT_PUBLIC_APP_URL` | `https://finanzen.jannikjbi.de` |
   | `BETTER_AUTH_SECRET` | dasselbe Secret wie lokal (oder ein neues – dann sind alte Sessions ungültig) |
   | `BETTER_AUTH_API_KEY` | Key aus dem Better-Auth-Dashboard |
   | `NEXT_PUBLIC_BETTER_AUTH_IDENTIFY_URL` | Ingestion-URL aus den Projekt-Settings |
   | `MONGODB_URI` / `MONGODB_DB` | aus der Atlas-Integration |
   | `ALLOWED_EMAILS` | deine Adresse(n) |
   | `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | aus dem Discord-Portal |

4. *Settings → Domains* → `finanzen.jannikjbi.de` hinzufügen und den DNS-Eintrag
   bei deinem Provider setzen.
5. In Atlas unter *Network Access* `0.0.0.0/0` freigeben – Vercel-Functions haben
   keine festen IPs.
6. Discord-Redirect für die Produktionsdomain nicht vergessen (siehe oben).

Nach jeder Änderung an den Environment Variables einmal neu deployen.

## Nur du kommst rein

- Registrierung ist grundsätzlich gesperrt: ein `databaseHook` in
  [lib/auth.ts](lib/auth.ts) bricht jede Konto-Erstellung ab, deren Mailadresse
  nicht in `ALLOWED_EMAILS` steht – egal ob E-Mail/Passwort oder Discord.
- [middleware.ts](middleware.ts) schützt alle App-Routen; ohne Session geht es
  zurück auf `/login`.
- Jede Abfrage filtert zusätzlich nach `userId`.

## Funktionen

- **Dashboard** – Einnahmen, Ausgaben und Saldo des Monats mit Vormonatsvergleich,
  Fixkosten-Block (Abos pro Monat/Jahr, feste Einnahmen, Fixkosten-Saldo),
  6-Monats-Verlauf, Kategorie-Donut, nächste Abos und letzte Buchungen.
  Feste Einnahmen werden hier verwaltet.
- **Buchungen** – anlegen, bearbeiten, löschen; Filter nach Typ und Kategorie,
  Monatswechsel, Summen pro Auswahl. Der Dialog legt wahlweise eine einmalige
  Buchung oder direkt einen Dauerauftrag an. Das Datum muss kein genauer Tag
  sein: wahlweise **genauer Tag**, **Zeitraum** (z. B. 1.–10.10.) oder
  **ganzer Monat**. In der Liste steht alles dran – Zeitraum, Kategorie, Konto,
  Notiz und ob die Buchung aus einem Abo stammt.
- **Abos** – ausschließlich regelmäßige Ausgaben, hochgerechnet auf Monat und
  Jahr, mit nächster Fälligkeit und teuerstem Abo. „Buchen" übernimmt eine
  fällige Zahlung als echte Buchung.
- **Auswertung** – Jahresübersicht: Monatsverlauf mit Saldo, Sparquote,
  Kategorien über das ganze Jahr, größte Einzelausgaben, bester und schwächster
  Monat.
- **Budgets & Sparziele** – Monatsbudget je Ausgaben-Kategorie mit Fortschritt
  und Drei-Monats-Durchschnitt als Orientierung; Sparziele mit Zielbetrag,
  Zieldatum und Ein-/Auszahlung.
- **Erstattungen** – Geld, das dir zurückgezahlt wird, auch ohne bekannten
  Termin (Zeitpunkt unbekannt, bestimmter Tag oder Zeitraum). „Erhalten" bucht
  den Betrag als Einnahme, der tatsächliche Betrag lässt sich dabei anpassen.
  Die offene Summe steht auf dem Dashboard.
- **Konten** – mehrere Konten mit Startsaldo, laufender Kontostand aus den
  zugeordneten Buchungen, Gesamtvermögen und Umbuchung zwischen Konten.
- **Import / Export** – Buchungen als CSV herunterladen (gesamt oder pro Jahr)
  und CSV importieren, inklusive Kategoriezuordnung über den Namen.
- **Einstellungen** – eigene Kategorien für Einnahmen und Ausgaben mit Symbol,
  Farbe und optionalem Monatsbudget.

Die Oberfläche ist für Handy und Desktop gebaut: ab `lg` eine Sidebar mit
gruppierter Navigation, darunter eine feste untere Leiste mit den vier
wichtigsten Bereichen und einem Menü für den Rest.

## Struktur

```
app/(app)/           Geschützte Seiten: Dashboard, Buchungen, Abos,
                     Erstattungen, Auswertung, Budgets, Konten,
                     Import/Export, Einstellungen
app/login/           Login & Registrierung
app/api/auth/        Better-Auth-Handler
app/api/export/      CSV-Export
lib/auth.ts          Auth-Konfiguration + Zugangssperre
lib/mongo.ts         MongoDB-Client, Collections, Indizes
lib/queries.ts       Lesezugriffe und Aggregationen (server-only)
lib/actions.ts       Server Actions (Schreiben)
lib/types.ts         Typen, die Client und Server teilen
lib/nav.ts           Navigationsstruktur
lib/csv.ts           CSV lesen und schreiben
components/ui.tsx    Design-System: PageHeader, StatCard, SectionCard, Bar
components/          Übrige HeroUI-Oberfläche
```

**Wichtig bei HeroUI:** Collection-Komponenten (`SelectItem`, `TableRow`,
`DropdownItem`, `Tab` …) müssen in einer Client-Komponente stehen. Aus einer
Server Component kommt dort nur eine RSC-Referenz an, und react-stately wirft
`Unknown element <[object Object]> in collection`.

Beträge werden immer als Ganzzahl in Cent gespeichert – keine Rundungsfehler.
