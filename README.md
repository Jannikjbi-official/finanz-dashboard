# Finanzen

Private, installierbare Finanz-App (PWA) für genau eine Person: Ausgaben, Einnahmen, Abos, Wunschliste,
Budgets und Statistik – auf Handy und PC wie eine native App.

**Stack:** Next.js 16 (App Router, Server Actions) · HeroUI v3 + Tailwind CSS v4 · Recharts · Neon Postgres +
Drizzle ORM · Better Auth (Discord-OAuth) · Zod · Vercel

---

## Inhalt

1. [Funktionen](#funktionen)
2. [Lokal starten](#lokal-starten)
3. [Discord-Application einrichten](#discord-application-einrichten)
4. [Notfall-Passwort erzeugen](#notfall-passwort-erzeugen)
5. [Umgebungsvariablen](#umgebungsvariablen)
6. [Neon verbinden](#neon-verbinden)
7. [Auf Vercel deployen](#auf-vercel-deployen)
8. [App installieren](#app-installieren)
9. [Projektstruktur](#projektstruktur)
10. [Sicherheit](#sicherheit)

---

## Funktionen

| Bereich | Highlights |
| --- | --- |
| **Dashboard** | Kennzahlen (Einkommen, Ausgaben, Abos, übrig) mit Veränderung zum Vormonat, „Monat verbraucht" (ProgressCircle), „Pro Tag noch verfügbar" (Meter), Donut nach Kategorie, Einnahmen vs. Ausgaben (12 Monate), Kontostand-Verlauf, nächste Abbuchungen (7 Tage), Budget-Warnungen, Monatswechsler mit Kalender |
| **Ausgaben** | „+" schwebend am Handy → Drawer von unten (wischen zum Schließen), Modal am PC · Betrag sofort fokussiert · Kategorie mit Farbe/Icon · Zahlungsart · wiederkehrend · Tabelle mit Sortierung, Mehrfachauswahl, Massenlöschen, Spaltenbreite, Summen-Footer, Pagination und Virtualisierung („Alle") · Kartenliste nach Tagen am Handy · Filter: Suche, Zeitraum, Kategorien, Zahlungsart · Löschen mit „Rückgängig" |
| **Einnahmen** | Quelle (Gehalt, Twitch, Nebenjob, Sonstiges + eigene), wiederkehrend, Tabs Monat/Jahr, Verlauf |
| **Abos** | Intervall, Abbuchungstag, Kündigungsfrist, Status · Umrechnung pro Monat **und** Jahr · Gesamt-Card · Kalender mit Abbuchungstagen · Warnung „Kündigungsfrist endet bald" · fließen automatisch in die Monatsrechnung ein |
| **Wunschliste** | Card-Raster mit Bild, Priorität, Sparziel & Fortschritt, „Leistbar diesen Monat", Sortierung, „Gekauft" → optional als Ausgabe übernehmen |
| **Budgets & Kategorien** | Name, Farbe (ColorPicker), Icon, Monatsbudget · Farbe wechselt bei 80 %/100 % |
| **Statistik** | Zeitraum (Schnellauswahl + DateRangePicker/RangeCalendar), Tabs Übersicht/Kategorien/Verlauf, Top-Kategorien, größte Einzelausgaben, Ø pro Tag/Woche/Monat, Vergleich zum Vorzeitraum, Sparquote |
| **Umrechner** | Währungen umrechnen (USD → EUR & Co.) mit EZB-Referenzkursen, Schnellwahl, Tauschen, Liste gängiger Währungen, Ergebnis direkt als Ausgabe erfassen · Kurse 6 h gecacht, offline letzter Stand · kostenlos ohne API-Key ([frankfurter.dev](https://frankfurter.dev)) |
| **Einstellungen** | Hell/Dunkel/System, Akzentfarbe, Startguthaben, Export CSV/JSON, Import JSON, alles löschen, Konto (abmelden / auf allen Geräten abmelden), App installieren, App-Sperre, Version |

Weiteres: Discord-Login mit Allowlist, Notfall-Login, PWA (offline, Warteschlange für offline erfasste Einträge,
App-Shortcuts, eigener Installationshinweis), Tastaturkürzel **N** (neue Ausgabe) und **/** (Suche),
View Transitions, `prefers-reduced-motion`, Safe-Area am iPhone, `noindex`.

Alle Beträge werden als **Cent-Integer** gespeichert, angezeigt im Format `1.234,56 €`, Datum `TT.MM.JJJJ`,
Zeitzone `Europe/Berlin`.

---

## Lokal starten

Voraussetzungen: **Node.js 22+** und eine Postgres-Datenbank (lokal oder ein Neon-Branch).

```bash
npm install
cp .env.example .env        # Werte eintragen (siehe unten)
npm run db:migrate          # Tabellen anlegen
npm run db:seed             # optional: Beispieldaten (nur lokal!)
npm run dev                 # http://localhost:3000
```

Eine lokale Postgres per Docker:

```bash
docker run -d --name finanzen-db -e POSTGRES_USER=finanz -e POSTGRES_PASSWORD=finanz -e POSTGRES_DB=finanz -p 5432:5432 postgres:16
```

Nützliche Skripte:

| Skript | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm start` | Produktions-Build lokal |
| `npm run typecheck` | TypeScript prüfen |
| `npm run db:generate` | Neue Drizzle-Migration aus `src/lib/db/schema.ts` erzeugen |
| `npm run db:migrate` | Migrationen anwenden (läuft auf Vercel automatisch beim Build) |
| `npm run db:studio` | Drizzle Studio (Datenbank im Browser ansehen) |
| `npm run db:seed` | Beispieldaten – verweigert die Ausführung auf Neon/Vercel |
| `npm run hash-password` | bcrypt-Hash für den Notfall-Login erzeugen |
| `npm run icons` | App-Icons & iOS-Splashscreens aus `public/icons/icon.svg` neu erzeugen |

> **Ohne Discord testen:** Lokal einfach den Notfall-Login verwenden (Hash siehe unten).

---

## Discord-Application einrichten

1. Öffne <https://discord.com/developers/applications> und klicke **New Application**.
   Name z. B. „Finanzen", Bedingungen akzeptieren, **Create**.
2. Links **OAuth2** öffnen.
   - **Client ID** kopieren → `DISCORD_CLIENT_ID`
   - **Client Secret → Reset Secret** → kopieren → `DISCORD_CLIENT_SECRET`
     (wird nur einmal angezeigt; niemals ins Repository oder in einen Chat schreiben)
3. Unter **OAuth2 → Redirects** genau diese Adressen eintragen und **Save Changes**:
   ```
   http://localhost:3000/api/auth/callback/discord
   https://DEINE-VERCEL-DOMAIN/api/auth/callback/discord
   ```
   `DEINE-VERCEL-DOMAIN` ist die Produktionsdomain des Vercel-Projekts (z. B. `finanz-dashboard.vercel.app`
   oder eine eigene Domain wie `finanzen.example.de`). Für jede weitere Domain eine eigene Zeile.
4. Es wird **nur der Scope `identify`** verwendet (keine E-Mail, keine Server). Unter „OAuth2 URL Generator"
   musst du nichts erzeugen – die App baut den Login-Link selbst.
5. Ein Bot ist **nicht** nötig. Falls die Application einen Bot hat: „Public Bot" kann aus bleiben.

### Deine Discord-User-ID finden

1. Discord → **Einstellungen → Erweitert → Entwicklermodus** einschalten.
2. Auf dein Profilbild/deinen Namen rechtsklicken (Handy: lange drücken) → **Benutzer-ID kopieren**.
3. Die Zahl (17–20 Stellen) als `ALLOWED_DISCORD_ID` eintragen.

Nur diese ID darf sich anmelden. Jede andere wird schon beim OAuth-Callback abgewiesen – es wird **kein Nutzer
und keine Session angelegt**, stattdessen erscheint „Kein Zugriff".

---

## Notfall-Passwort erzeugen

Falls Discord einmal nicht erreichbar ist, gibt es auf der Login-Seite den kleinen Link **„Notfall-Login"**.
Gespeichert wird nur ein bcrypt-Hash (Kosten 12), nie das Passwort. Max. **5 Versuche pro 15 Minuten**.

```bash
npm run hash-password
# Passwort eingeben (unsichtbar, mind. 12 Zeichen)
```

Ausgegeben werden zwei Zeilen:

- **Für Vercel:** den Hash genau so (mit `$`-Zeichen) als `EMERGENCY_PASSWORD_HASH` eintragen.
- **Für die lokale `.env`:** die Variante mit `\$` verwenden (Next.js würde `$…` sonst als Variable lesen).

---

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `DATABASE_URL` | ✔ | Neon-Verbindung (gepoolt). Auf Vercel setzt die Neon-Integration sie automatisch. |
| `DATABASE_URL_UNPOOLED` | – | Direkte Verbindung für Migrationen (setzt die Neon-Integration ebenfalls). |
| `AUTH_SECRET` | ✔ | Zufälliger Schlüssel ≥ 32 Zeichen: `openssl rand -base64 32` |
| `DISCORD_CLIENT_ID` | ✔ | Aus dem Discord Developer Portal |
| `DISCORD_CLIENT_SECRET` | ✔ | Aus dem Discord Developer Portal |
| `ALLOWED_DISCORD_ID` | ✔ | Deine Discord-User-ID |
| `EMERGENCY_PASSWORD_HASH` | empfohlen | bcrypt-Hash für den Notfall-Login |
| `BETTER_AUTH_URL` | – | Öffentliche Adresse. Auf Vercel nicht nötig (Produktionsdomain wird automatisch erkannt). |

Auf Vercel alle geheimen Werte als **Sensitive** anlegen (Environments: Production + Preview).

---

## Neon verbinden

1. Vercel-Dashboard → Projekt → **Storage → Create Database → Neon (Serverless Postgres)**.
2. Region nahe bei dir wählen (z. B. Frankfurt `fra1`/`aws-eu-central-1`), Plan „Free" reicht.
3. **Connect Project** → dieses Projekt auswählen, Environments **Production** und **Preview** anhaken.
   Vercel legt `DATABASE_URL`, `DATABASE_URL_UNPOOLED` usw. automatisch an.
4. Neu deployen (Deployments → … → **Redeploy**). Beim Build läuft `npm run db:migrate` automatisch und legt
   alle Tabellen an. Beim ersten Öffnen werden die Standard-Kategorien angelegt.

Für die lokale Entwicklung kannst du in Neon einen eigenen **Branch** anlegen und dessen Connection-String in die
`.env` schreiben – so bleiben Produktionsdaten unberührt.

---

## Auf Vercel deployen

1. Projekt auf Vercel mit diesem GitHub-Repository verbinden (Framework „Next.js" wird erkannt).
2. [Neon verbinden](#neon-verbinden) und die [Umgebungsvariablen](#umgebungsvariablen) setzen.
3. In Discord die Redirect-URL `https://DEINE-DOMAIN/api/auth/callback/discord` eintragen.
4. Push auf `main` → Vercel baut automatisch. Der Build-Befehl ist `npm run vercel-build`
   (= Migrationen + `next build`).
5. Domain öffnen → „Mit Discord anmelden".

**Hinweis Previews:** Preview-Deployments haben eigene URLs. Discord-Login funktioniert dort nur, wenn die
Preview-URL zusätzlich als Redirect eingetragen ist – der Notfall-Login geht immer.

---

## App installieren

- **iPhone/iPad (Safari):** Seite öffnen → Teilen-Symbol → **Zum Home-Bildschirm**.
- **Android (Chrome):** Hinweis „App installieren" in der App antippen oder Menü ⋮ → **App installieren**.
- **PC (Chrome/Edge):** Installieren-Symbol in der Adressleiste oder Einstellungen → App → **Installieren**.

Die App läuft dann ohne Browserleiste im Vollbild (Notch und Home-Indikator werden berücksichtigt) und hat
App-Shortcuts (lange auf das Icon drücken): **Ausgabe hinzufügen**, **Abos**, **Wunschliste**.

**Login in der installierten App:** Discord öffnet sich auf iPhone/Android in einem separaten Browserfenster,
das keine Cookies mit der App teilt. Die App startet deshalb eine sichere Login-Übergabe: Nach dem Login bei
Discord zeigt das Fenster „Angemeldet" – zurück in der App bist du automatisch eingeloggt
(einmalige Übergabe mit nur der App bekanntem Geheimnis, gültig 10 Minuten).

**Offline:** Bereits geöffnete Seiten bleiben offline verfügbar, sonst erscheint eine Offline-Seite.
Offline erfasste Ausgaben/Einnahmen landen in einer Warteschlange und werden gespeichert, sobald wieder
Verbindung besteht (ohne Doppelbuchungen).

---

## Projektstruktur

```
src/
  app/
    (auth)/            Login, Login-Übergabe (PWA), „Kein Zugriff"
    (app)/             Geschützte Seiten: Dashboard, Ausgaben, Einnahmen, Abos, Wunschliste,
                       Budgets, Statistik, Einstellungen, Mehr (Handy)
    api/auth/[...all]  Better Auth (Discord-OAuth, Notfall-Login, Login-Übergabe)
    api/export         CSV-/JSON-Export
    api/sync           Offline-Warteschlange
    manifest.ts        Web-App-Manifest
    offline/           Offline-Seite
  components/          UI nach Bereichen (shell, dashboard, expenses, …) – ausschließlich HeroUI v3
  lib/
    auth/              Better-Auth-Konfiguration, Allowlist, Session-Helfer
    db/                Drizzle-Schema & Client
    dates.ts money.ts  Formatierung (de-DE, Europe/Berlin, Cent ↔ Euro)
    finance.ts         Abo-Abbuchungen, Intervalle, Budget-Stufen
    validation.ts      Zod-Schemas (Server-Validierung)
  server/
    actions.ts         Server Actions (prüfen jeweils die Session + Zod)
    queries.ts         Datenabfragen (prüfen jeweils die Session)
    recurring.ts       Wiederkehrende Buchungen erzeugen
  proxy.ts             Schützt alle Seiten/APIs (außer Login, Callback, Manifest, Icons, Service Worker)
drizzle/               SQL-Migrationen
public/sw.js           Service Worker
scripts/               migrate, seed, hash-password, generate-icons
```

---

## Sicherheit

- Login ausschließlich über Discord (Scope `identify`) + Allowlist auf **eine** User-ID; Prüfung beim Callback,
  zusätzlich in Datenbank-Hooks (Nutzer & Session) und bei jeder Session-Abfrage.
- Sessions 30 Tage, Cookies `httpOnly`, `secure`, `SameSite=Lax`; „auf allen Geräten abmelden" widerruft alle.
- Proxy (früher „Middleware") schützt alle Routen; **jede** Server Action, Abfrage und API-Route prüft die Session
  zusätzlich selbst.
- Notfall-Login: bcrypt-Hash, Rate-Limit 5 Versuche / 15 Minuten (in der Datenbank, gilt über alle Instanzen).
- Eingaben werden serverseitig mit Zod validiert.
- `noindex` per Meta-Tag, `X-Robots-Tag`-Header und `robots.txt`.
- Optionale App-Sperre: automatisches Abmelden nach X Minuten Inaktivität (Einstellungen → App).
