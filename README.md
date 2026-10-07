# Spielraum

Kostenlose Finanzplattform: Konten, Fixkosten, Budgets und Ziele – mit einer
Prognose für die nächsten 90 Tage, einer nachvollziehbaren Sicherheitszone,
„Kann ich mir das leisten?“ und einer Sandbox für Was-wäre-wenn.

Next.js 15 (App Router) · React 19 · Tailwind 4 · Radix · Better Auth · MongoDB · Vitest

> Der Produktname steht an genau einer Stelle: [lib/brand.ts](lib/brand.ts).

## Schnellstart (lokal)

```bash
npm install
cp .env.example .env          # BETTER_AUTH_SECRET setzen
npm run dev:db                # lokale MongoDB ohne Installation (eigenes Terminal)
npm run beta:invite -- du@example.org
npm run dev                   # http://localhost:3000
```

Registrieren geht dann über `http://localhost:3000/registrieren?einladung`.
Zum Ausprobieren mit Beispieldaten: `npm run dev:seed -- du@example.org`
(nur gegen eine lokale Datenbank).

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` / `build` / `start` | Entwicklung, Produktions-Build, Start |
| `npm run typecheck` | TypeScript prüfen |
| `npm test` | Alle Tests (Fachlogik, Import, Isolation gegen MongoDB im Speicher) |
| `npm run dev:db` | Lokale MongoDB auf Port 27017, Daten in `.devdb/` |
| `npm run dev:seed -- <mail>` | Beispieldaten in ein lokales Testkonto |
| `npm run db:backup` | Alle Collections als Extended JSON nach `backups/` |
| `npm run db:restore -- <ordner> [--replace]` | Sicherung zurückspielen (mit `--replace` wird vorher gesichert) |
| `npm run db:migrate [-- --dry-run]` | Ausstehende Migrationen (sichert vorher automatisch) |
| `npm run beta:invite -- <mail>` | Adresse für die Closed Beta freischalten (`--list`, `--remove`) |
| `npm run waitlist` | Warteliste ansehen (`--invite <mail>`, `--remove <mail>`) |

## Konfiguration

Siehe [.env.example](.env.example). Wichtig für den Betrieb:

- `ALLOWED_EMAILS` – wer sich immer anmelden/registrieren darf (Betreiber).
- `BETA_OPEN=true` – öffnet die Registrierung für alle.
- `LEGAL_*` – Anbieterangaben für Impressum und Datenschutz. Ohne sie zeigen
  beide Seiten einen Hinweis. `LEGAL_REVIEWED=true` erst nach rechtlicher Prüfung.

## Umstieg von der früheren Version

Die bestehenden Daten bleiben erhalten und gehören weiter deinem Konto. Vor dem
ersten Deploy der neuen Version:

1. Sicherung ziehen: Atlas-Snapshot **und** `npm run db:backup` mit der
   Produktions-`MONGODB_URI`.
2. `npm run db:migrate -- --dry-run` – zeigt, was passiert.
3. `npm run db:migrate` – ergänzt Einstellungen, markiert alte Umbuchungen,
   übernimmt Erstattungen nach „Geplant & erwartet“, korrigiert verrutschte
   Abo-Termine. Es wird nichts gelöscht.

Alte Adressen (`/transaktionen`, `/abos`, …) leiten auf die neuen Seiten weiter.

## Aufbau

```
app/(site)/        Öffentliche Website: Start, Funktionen, Sicherheit, FAQ,
                   Warteliste, Impressum, Datenschutz
app/(auth)/        Anmelden, Registrieren (nur mit Einladung)
app/willkommen/    Onboarding
app/app/           Eingeloggter Bereich: Lage, Geld, Planung, Entscheiden,
                   Rückblick, Einstellungen
lib/domain/        Reine, getestete Fachlogik: Kalender, Intervalle, Prognose,
                   Sicherheitszone, Kaufcheck, Ziele, Budgets, Auffälligkeiten
lib/server/        Datenzugriff (immer an userId gebunden), Eigentumsprüfung,
                   Rate Limit, Migrationen, Server Actions
lib/actions.ts     Server Actions für Buchungen, Konten, Kategorien, Fixkosten, Ziele
ui/                Designsystem
features/          Oberflächen der einzelnen Bereiche
scripts/           Kommandozeile: Backup, Restore, Migration, Beta, Warteliste
docs/              Bestandsaufnahme und Umbauplan
```

## Grundsätze

- **Isolation auf dem Server:** jede Abfrage enthält die `userId`, referenzierte
  Konten/Kategorien werden auf Eigentum geprüft. Tests prüfen das gegen eine
  echte MongoDB.
- **Beträge in Cent** als Ganzzahl.
- **Umbuchungen** (`transferGroupId`) zählen nie als Einnahme oder Ausgabe.
- **Prognose vorsichtig:** Ausgaben früh, erwartete Einnahmen spät, ohne Termin gar nicht.
- **Keine Telemetrie**, keine Drittanbieter-Skripte, strenge Sicherheits-Header.
