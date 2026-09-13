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

### Discord einrichten

1. https://discord.com/developers/applications → New Application
2. OAuth2 → Redirect hinzufügen: `http://localhost:3000/api/auth/callback/discord`
3. Client ID und Client Secret in die `.env` eintragen, Server neu starten.

Wichtig: Die Discord-Mailadresse muss ebenfalls in `ALLOWED_EMAILS` stehen,
sonst wird der Login abgelehnt.

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
