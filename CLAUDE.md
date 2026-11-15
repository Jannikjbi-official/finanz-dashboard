# Projektregeln „Finanzen“

Private Finanz-PWA für genau eine Person. Oberfläche, Commits und README auf **Deutsch**.

## Stack (verbindlich)
- Next.js 16 (App Router, Server Actions, `src/proxy.ts` statt Middleware)
- **HeroUI v3** (`@heroui/react`) mit Tailwind CSS v4 – ausschließlich die v3-Compound-API
  (`Card.Header`, `Modal.Backdrop` …). Keine rohen `<button>`/`<input>`/`<select>`, kein anderes UI-Kit.
  Doku: https://heroui.com/react/llms-full.txt
- Recharts (nur über `src/components/charts/lazy.tsx` einbinden – nachgeladen)
- Neon Postgres + Drizzle (`npm run db:generate` nach Schemaänderungen, Migrationen laufen beim Vercel-Build)
- Better Auth mit Discord (`identify`) + Allowlist `ALLOWED_DISCORD_ID`, Zod

## Klein halten (Vercel & Neon Free)
- **Keine Uploads/Blob-Speicher**: Bilder nur als externe URL speichern.
- Neue Abhängigkeiten nur, wenn unvermeidbar; vorher Bundle-Größe prüfen. Große Client-Bibliotheken
  per `next/dynamic` nachladen.
- Bilder in `public/` als Paletten-PNG/SVG (`npm run icons`), keine großen Assets ins Repo.
- Datenbank: Beträge als Cent-`integer`, Datum als `date`; keine Logs/Verläufe in Tabellen schreiben.
  Abgelaufene Sessions/States/Rate-Limits räumt `src/server/maintenance.ts` täglich auf –
  neue Hilfstabellen dort mit aufräumen.
- Abfragen begrenzen (`limit`, Zeiträume), keine unbegrenzten Listen an den Client schicken.

## Konventionen
- Jede Server Action und API-Route prüft die Session selbst (`assertSession`/`getSession`),
  jede Abfrage in `src/server/queries.ts` über `guard()`.
- Eingaben immer serverseitig mit Zod (`src/lib/validation.ts`) prüfen.
- Formatierung nur über `src/lib/money.ts` und `src/lib/dates.ts` (de-DE, Europe/Berlin).
- Mobile-first, Touch-Ziele ≥ 44 px, Handy/PC-Varianten per CSS-Breakpoint (hydration-sicher).
- Vor dem Commit: `npm run typecheck` und `npm run build`.
- Commits als Autor `jannikjbi <jannikbolting23@gmail.com>`.
