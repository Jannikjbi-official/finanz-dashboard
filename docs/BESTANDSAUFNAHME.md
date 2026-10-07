# Bestandsaufnahme & Umbauplan

Stand: 07.10.2026 · Basis: Commit `4a33930` (main, sauber)

Dieses Dokument ist Phase 1 (Analyse) und der Entwurf für Phase 2 (Architektur).
Es wurde noch keine bestehende Datei verändert.

---

## 1. Bestehende Architektur

| Bereich | Ist-Zustand |
| --- | --- |
| Framework | Next.js 15.5 (App Router), React 19, TypeScript 5.9 strict |
| UI | HeroUI 2.8 + Tailwind 4, erzwungenes Dark-Theme (Indigo `#6366f1`), framer-motion |
| Daten | MongoDB-Treiber 7 direkt (kein ORM), Typen in `lib/mongo.ts` |
| Auth | Better Auth 1.7 (E-Mail/Passwort + Discord), MongoDB-Adapter, Sessions 30 Tage, Cookie-Cache 5 min |
| Schreiben | Server Actions in `lib/actions.ts` (≈800 Zeilen, eine Datei), Validierung teils mit Zod, teils manuell |
| Lesen | `lib/queries.ts` (`server-only`), Aggregationen pro Request |
| API | nur `/api/auth/[...all]` und `/api/export` (CSV) |
| Schutz | `middleware.ts` prüft nur, *ob* ein Session-Cookie existiert; echte Prüfung in `requireUser()` |
| Deployment | Vercel + MongoDB Atlas, Domain `finanzen.jannikjbi.de` |
| Tests | **keine** (kein Test-Runner, kein Lint-Setup außer `next lint`) |
| Umfang | 65 Dateien, ≈5.400 Zeilen in `app/` und `components/` |

### Collections

| Collection | Inhalt | Isoliert über |
| --- | --- | --- |
| `user`, `session`, `account`, `verification` | Better Auth | – |
| `categories` | Name, Typ, Farbe, Emoji, Monatsbudget | `userId` (+ Unique-Index `userId,kind,name`) |
| `transactions` | Betrag in Cent, Typ, Datum (+ unscharf: Zeitraum/Monat), Kategorie, Konto, Abo-Herkunft | `userId` |
| `recurring` | Abos/feste Einnahmen, Intervall, `nextDue`, aktiv | `userId` |
| `goals` | Sparziele, Ziel- und Ist-Betrag, Deadline | `userId` |
| `refunds` | erwartete Erstattungen, offen/erhalten | `userId` |
| `accounts` | Geldkonten mit Startsaldo (Achtung: Namensnähe zu Better-Auths `account`) | `userId` |

Lokale MongoDB (`127.0.0.1:27017`) läuft aktuell nicht – die echten Daten liegen
vermutlich in der Atlas-Datenbank der Produktion. Darauf habe ich keinen Zugriff
und habe auch keinen versucht.

---

## 2. Bestehende Funktionen

| Funktion | Zustand |
| --- | --- |
| Login E-Mail/Passwort, Discord | funktioniert, aber per `ALLOWED_EMAILS` auf dich gesperrt |
| Buchungen CRUD, Filter Typ/Kategorie, Monatswechsel | funktioniert |
| Unscharfe Datumsangaben (Tag / Zeitraum / Monat) | funktioniert, gute Idee – behalten |
| Kategorien mit Budget | funktioniert |
| Abos / feste Einnahmen, „Buchen" übernimmt Fälligkeit | funktioniert, nur manuell |
| Konten mit Startsaldo, laufender Saldo, Umbuchung | funktioniert, Umbuchungen verfälschen aber Statistiken (s. u.) |
| Sparziele mit Ein-/Auszahlung | funktioniert, aber losgelöst von Konten und Buchungen |
| Erstattungen (Datum unbekannt/Tag/Zeitraum) | funktioniert, gute Idee – wird zu „erwartete Einnahme" |
| Jahresauswertung, Top-Ausgaben, bester/schwächster Monat | funktioniert |
| CSV-Import (Trennzeichen-/Datumserkennung, Kategorie per Name) | teilweise: keine Spaltenzuordnung, keine Vorschau, keine Dubletten |
| CSV-Export gesamt/pro Jahr | funktioniert, nur Buchungen |
| Dashboard | viele Kennzahlen nebeneinander, keine Hierarchie, keine Zukunftssicht |

**Fehlt komplett:** Registrierung für alle, E-Mail-Verifizierung, Passwort
vergessen, Onboarding, Landingpage/Impressum/Datenschutz/FAQ, Prognose,
Sicherheitszone, Leistbarkeits-Check, Sandbox, Kalender, Monatsbericht,
Zeitreise, Auffälligkeiten, JSON-/Vollexport, Account-Löschung, Nutzer-
einstellungen (Währung, Zeitzone, Mindestreserve), Tests.

---

## 3. Was wiederverwendbar ist

**Übernehmen (ggf. verbessern):**
- Beträge als Ganzzahl in Cent, `parseAmountToCents`, `formatMoney`
- Datenmodell aller sechs Fach-Collections – es ist bereits pro `userId` getrennt
- Unscharfe Daten (`datePrecision`, `dateEnd`) inkl. `formatPeriod`
- `monthlyAmount`/`yearlyAmount`, Intervall-Logik (nach Bugfix, s. u.)
- CSV-Parser (Trennzeichen, Quotes, deutsche Daten, Vorzeichen-Logik) – als Kern für den neuen Import-Assistenten
- Aggregationen in `queries.ts` (Monatssummen, Kategorien, Budget-Ø, Kontosalden)
- Better Auth + MongoDB-Adapter, Next.js App Router, Server Actions, Zod
- Mongo-Client-Singleton und Index-Setup

**Nicht übernehmen:** sämtliche Komponenten in `components/`, HeroUI, `hero.ts`,
Navigation (`lib/nav.ts`), Seitenstruktur, Farbwelt, Logo, Login-Seite.

---

## 4. Technische Probleme (priorisiert)

### Sicherheit
1. **Keine E-Mail-Verifizierung.** Die zunächst vermutete Übernahme über Discord-Linking ist in Better Auth 1.7.4 bereits abgesichert (`requireLocalEmailVerified` ist standardmäßig aktiv – unbestätigte lokale Konten werden nicht automatisch verknüpft). Trotzdem: Option ausdrücklich setzen, damit ein Update sie nicht still ändert, und Verifizierung einführen, sobald ein Mail-Dienst existiert. Bis dahin Closed Beta über Freischaltliste.
2. **Fremde IDs werden ungeprüft referenziert:** `categoryId`/`accountId` in Buchungen, Abos, Erstattungen, Import werden nur auf ObjectId-Format geprüft, nicht auf Eigentum. Kein Datenleck beim Lesen (alles filtert nach `userId`), aber inkonsistente Daten möglich. → Eigentumsprüfung zentral.
3. **CSV-Injection im Export:** Zellen, die mit `=`, `+`, `-`, `@` beginnen, werden nicht entschärft.
4. **Kein Rate Limiting** für Server Actions und Import; Better-Auth-Limiter nutzt standardmäßig Speicher – auf Vercel wirkungslos.
5. **Keine Größenbegrenzung** beim Import (Datei/Zeilen).
6. **Drittanbieter-Telemetrie:** `@better-auth/infra` (`dash()` + `sentinelClient`) schickt Nutzer-/Sessiondaten an einen externen Dienst – für eine öffentliche DSGVO-Plattform zu prüfen bzw. zu entfernen.
7. Keine Security-Header (CSP, Frame-Options …).

Positiv: keine Secrets im Repo oder in der Git-Historie, `.env` ist ignoriert,
jede Abfrage und jede Action filtert bereits nach `userId`.

### Fachliche Fehler
8. **Umbuchungen zählen als Einnahme + Ausgabe** → Dashboard, Budgets („Ohne Kategorie"), Jahresauswertung und Sparquote sind verfälscht. → eigener Typ `transfer` bzw. `transferGroupId`.
9. **Monatsende-Drift bei Abos:** `advance("2026-01-31", "monthly")` ergibt `2026-03-03` (JS-Überlauf); danach bleibt das Abo verschoben.
10. **Zeitzone:** `todayISO()` nutzt die Serverzeit – auf Vercel UTC. Zwischen 0 und 2 Uhr deutscher Zeit ist „heute" falsch.
11. **Sparziele hängen an nichts:** `savedCents` wird von Hand gepflegt, ohne Bezug zu Konten → für Prognose/Zielkonflikte unbrauchbar.
12. Buchungen ohne Konto fehlen im Kontostand, das Dashboard mischt dann zwei Definitionen von „verfügbar".
13. Mehrschrittige Schreibvorgänge (Kategorie löschen, Erstattung buchen, Abo buchen) ohne Transaktion.

### Struktur
14. Eine 800-Zeilen-Actions-Datei, Typen doppelt (`mongo.ts`/`types.ts`), Fachlogik in Seiten verteilt (z. B. `available` im Dashboard).
15. `/daten` lädt *alle* Buchungen, nur um die Jahre zu bestimmen; Export ebenso ohne Streaming.
16. `de-DE`/EUR fest verdrahtet, Dark Mode erzwungen.
17. Keine Tests, kein Linter (`next lint` ist veraltet).

---

## 5. Datenmigration

**Gute Nachricht:** Die Daten sind bereits mandantenfähig. Jeder Fachdatensatz
trägt `userId` (Better-Auth-ID). Deine bestehenden Daten bleiben also deinem
Konto zugeordnet, ohne dass sie umgeschrieben werden müssen.

Nötige, nicht-destruktive Migrationen (jeweils mit `--dry-run`, protokolliert in
einer `migrations`-Collection, idempotent):

| # | Migration | Art |
| --- | --- | --- |
| 001 | Backup aller Fach-Collections als JSON (zusätzlich `mongodump`/Atlas-Snapshot vor dem Deploy) | nur lesen |
| 002 | `user_settings` je Nutzer anlegen (Währung EUR, Zeitzone Europe/Berlin, Mindestreserve leer, Onboarding = erledigt für Bestandsnutzer) | neu |
| 003 | Umbuchungspaare erkennen (`note: "Umbuchung"`, gleiches Datum/Betrag, Titel „Umbuchung an/von") → `kind: "transfer"`, gemeinsame `transferGroupId` | Felder ergänzen, nichts löschen |
| 004 | `recurring.anchorDay` aus `startDate` ableiten, `nextDue` neu berechnen (Drift-Fix) | Feld ergänzen |
| 005 | Sparziele: optionales `accountId`, bisheriges `savedCents` bleibt als Startwert | Feld ergänzen |
| 006 | `schemaVersion` auf allen Dokumenten | Feld ergänzen |

Rollback: Felder werden nur ergänzt; alter Code ignoriert sie. Zusätzlich das
JSON-Backup aus 001 mit Wiederherstellungsskript.

---

## 6. Neue Architektur (Multi-User)

```
app/
  (site)/            öffentlich: Start, Funktionen, Sicherheit, FAQ, Datenschutz, Impressum
  (auth)/            anmelden, registrieren, passwort-vergessen, verifizieren
  app/               eingeloggter Bereich (eigener Pfad statt "/" → Landingpage liegt auf "/")
  api/               auth, export (CSV/JSON, gestreamt), import-preview
lib/
  domain/            reine, getestete Fachlogik ohne DB:
                     forecast, safety, affordability, budget-projection,
                     schedule (Intervalle), anomalies, report, money, dates (tz-fest)
  server/
    db.ts            Client, Collections, Indizes
    scope.ts         userScope(userId) → jede Abfrage bekommt userId erzwungen,
                     Eigentumsprüfung referenzierter IDs
    repos/           transactions, accounts, categories, recurring, goals, planned, settings
    actions/         Server Actions je Bereich, Zod-Schemas, Rate Limit
    migrations/      nummerierte Migrationen + Runner
  ui/                eigenes Komponentensystem (Radix-Primitives + Tailwind-Tokens)
```

Kernprinzipien:
- **Isolation strukturell, nicht per Disziplin:** Repos nehmen nur einen `UserScope` an; ein Query ohne `userId` ist im Code nicht mehr formulierbar. Tests prüfen „User A sieht nie User B" für jede Repo-Funktion.
- **Eine Prognose-Engine** (`domain/forecast`) liefert Tagessalden ab heute aus Kontoständen + Abos + geplanten Buchungen + erwarteten Einnahmen + Sparraten. Dashboard, Kalender, Leistbarkeits-Check, Sicherheitszone, Zielkonflikte und Sandbox rechnen *alle* damit – die Sandbox übergibt nur zusätzliche hypothetische Ereignisse, die DB bleibt unberührt.
- Auth: offene Registrierung, E-Mail-Verifizierung, Passwort-Reset (braucht einen Mail-Dienst), Rate-Limit-Speicher in MongoDB, Discord optional, Linking nur verifiziert.
- Datenschutz: Account-Löschung (inkl. aller Fachdaten), Vollexport JSON, keine Finanzdaten in Logs, Telemetrie raus.
- Tests: Vitest für `domain/` und Repo-Isolation (mit `mongodb-memory-server`), Playwright-Smoke für Kernflows.

---

## 7. Neue Informationsarchitektur

Aufgebaut nach den Fragen, die man an sein Geld stellt – nicht nach Datentabellen:

| Bereich | Beantwortet | Inhalt |
| --- | --- | --- |
| **Lage** | Wie steht es gerade? Was kommt? Was sollte ich wissen? | Sicherheitszone mit Begründung, Verlauf 90 Tage zurück → 90 Tage voraus, nächste Ereignisse, Hinweise (Budget, Auffälligkeiten, Zielkonflikte) |
| **Geld** | Wo ist mein Geld, was ist passiert? | Konten, Buchungen (Suche, Filter, Massenbearbeitung), Import |
| **Planung** | Was steht an? | Kalender/Zeitleiste, Fixkosten & Abos (Monat/Jahr/5 Jahre), Budgets mit Monatsend-Prognose, geplante Ausgaben & erwartete Einnahmen (ehem. Erstattungen), Ziele |
| **Entscheiden** | Kann ich mir das leisten? Was wäre wenn? | Leistbarkeits-Check, Sandbox mit Szenarien |
| **Rückblick** | Wie hat es sich entwickelt? | Monatsbericht, Analysen/Trends, Zeitreise (Stand zu Datum X) |
| Profil (Menü) | – | Kategorien, Einstellungen (Währung, Zeitzone, Reserve), Datenschutz, Export, Konto löschen |

Mobil: fünf Bereiche in einer unteren Leiste, „Buchung erfassen" als feste
Aktion in der Kopfzeile, Formulare als Bottom-Sheets, Tabellen werden zu Listen.

---

## 8. Neue Designsprache (Entwurf)

Leitmotiv **„Zeitachse"**: Finanzen als Linie von gestern über heute ins
Morgen. Das ersetzt das alte Kachel-Raster komplett.

- **Hell als Standard**, ruhiges, warmes Papierweiß statt Dunkelblau; Dark Mode als gleichwertige Variante.
- **Farbe sparsam:** Tinte (fast Schwarz) für Inhalte, *eine* Akzentfarbe (tiefes Petrol), Statusfarben gedämpft (Moosgrün / Ocker / Terrakotta / Ziegelrot) – keine Indigo/Purple-Töne mehr.
- **Typografie:** IBM Plex Sans für UI, IBM Plex Mono für Beträge (tabellarische Ziffern, präzise), eine Serifenschrift (Source Serif 4) nur für große Aussagen auf Landingpage und Monatsbericht.
- **Linien statt Boxen:** Haarlinien, Zeilenraster, Radius 4–6 px, kaum Schatten. Karten nur dort, wo Inhalte wirklich eigenständig sind.
- **Zahlen im Mittelpunkt:** Beträge rechtsbündig, Vorzeichen konsistent, Cent kleiner gesetzt, Delta immer mit Bezug („+31 % ggü. Ø 6 Monate").
- **Diagramme selbst gebaut (SVG):** Saldo-Linie mit Sicherheitsband, Heute-Marker, Prognose gestrichelt; keine Donuts.
- **Navigation:** Kopfleiste mit fünf Bereichen + Unter-Tabs je Bereich (keine linke Sidebar mehr).
- Bewegung nur funktional (Übergänge von Sheets, Werte beim Monatswechsel).
- Komponenten: eigenes System auf Radix-Primitives; HeroUI und framer-motion fliegen raus.

---

## 9. Neue Funktionen (Umfang)

1. Offene Registrierung, Verifizierung, Passwort-Reset, Onboarding (Konto anlegen → Startsaldo → Einkommen → Fixkosten → Reserve)
2. Prognose-Engine + Cashflow 7/14/30/60/90 Tage
3. Sicherheitszone (stabil / angespannt / kritisch / unter Reserve) mit nachvollziehbarer Begründung
4. „Kann ich mir das leisten?" – vorher/nachher, Tiefpunkt, Reserve, Ziele, Erholung
5. Sandbox mit speicherbaren Szenarien (eigene Collection, nie Buchungen)
6. Geplante Buchungen & erwartete Einnahmen (Erstattungen gehen darin auf)
7. Sparziele mit Rate, erwartetem Erreichen, benötigter Rate, Zielkonflikten
8. Fixkosten mit Monat/Jahr/5 Jahre, automatische Fälligkeiten
9. Budgets mit Verbrauch, Rest, Monatsend-Prognose, Vormonate
10. Auffälligkeiten (Kategorie vs. eigener Durchschnitt, transparent berechnet)
11. Finanzkalender
12. Monatsbericht
13. Zeitreise (Stand an Stichtag)
14. Import-Assistent (Spaltenzuordnung, Vorschau, Validierung, Dubletten), Export CSV/JSON/Vollexport
15. Datenschutz-Center: Export, Löschung, Sitzungen verwalten

---

## 10. Phasen & Checkpoints

Jede Phase endet mit `tsc`, Build, Tests und lauffähiger App.

1. ✅ Analyse (dieses Dokument)
2. Fundament: Vitest, `lib/domain` mit Tests (Bugfixes 8–10), Migrations-Runner + Backup-Skript
3. Multi-User: Scope-Repos, Eigentumsprüfung, Auth (Verifizierung, Reset, Rate Limit), Telemetrie raus, Isolationstests
4. Core: Transfers, Ziele an Konten, geplante Buchungen, Settings
5. Neues Designsystem + App-Shell + alle App-Seiten (HeroUI entfernt)
6. Prognose, Sicherheitszone, Budget-Prognose, Auffälligkeiten, Bericht, Zeitreise
7. Leistbarkeits-Check + Sandbox
8. Website, Login/Registrierung, Onboarding, Rechtliches
9. Security-Header, Datenschutz-Center, Performance
10. E2E-Tests, Polish, Doku
