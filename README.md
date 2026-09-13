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

- **Dashboard** – Einnahmen, Ausgaben, Saldo und Abo-Kosten des Monats,
  Vergleich zum Vormonat, 6-Monats-Verlauf, Kategorie-Donut, fällige Abos.
- **Buchungen** – anlegen, bearbeiten, löschen; Filter nach Typ und Kategorie,
  Monatswechsel, Summen pro Auswahl.
- **Abos** – Daueraufträge mit Intervall (wöchentlich, monatlich,
  vierteljährlich, jährlich). Alles wird auf Monats- und Jahreskosten
  hochgerechnet, inklusive Aufteilung nach Kategorie. „Buchen" übernimmt eine
  fällige Zahlung als echte Buchung und setzt die nächste Fälligkeit.
- **Einstellungen** – eigene Kategorien für Einnahmen und Ausgaben mit Symbol,
  Farbe und optionalem Monatsbudget (Budget-Überschreitung wird markiert).

## Struktur

```
app/(app)/           Dashboard, Buchungen, Abos, Einstellungen (geschützt)
app/login/           Login & Registrierung
app/api/auth/        Better-Auth-Handler
lib/auth.ts          Auth-Konfiguration + Zugangssperre
lib/mongo.ts         MongoDB-Client, Collections, Indizes
lib/queries.ts       Lesezugriffe und Dashboard-Aggregationen
lib/actions.ts       Server Actions (Schreiben)
components/          HeroUI-Oberfläche
```

Beträge werden immer als Ganzzahl in Cent gespeichert – keine Rundungsfehler.
