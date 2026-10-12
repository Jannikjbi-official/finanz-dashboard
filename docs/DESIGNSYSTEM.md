# Designsystem – Jannikjbi Finanzen

Leitidee: **Kontoauszug, nicht Spielautomat.** Ruhige Flächen, präzise Zahlen,
klare Hierarchie. Farbe trägt Bedeutung (Status, Richtung), nicht Dekoration.

Technik: HeroUI v3 (React Aria) + Tailwind 4. Alle Werte sind als
CSS-Variablen in `app/globals.css` definiert und überschreiben die
HeroUI-Standardvariablen. Dunkel ist Standard (`html.dark`), hell optional.

## Farben

Neutrale Töne mit leichtem Grün-Grau-Stich (Hue ≈ 160), damit die Oberfläche
weder kalt-blau noch violett wirkt.

| Token | Dunkel | Hell | Einsatz |
| --- | --- | --- | --- |
| `--background` | `oklch(0.165 0.004 160)` | `oklch(0.975 0.003 100)` | Seitengrund |
| `--surface` | `oklch(0.198 0.005 160)` | `oklch(0.995 0.002 100)` | Panels, Tabellen |
| `--surface-secondary` | `oklch(0.228 0.005 160)` | `oklch(0.958 0.004 110)` | Hover, Kopfzeilen |
| `--foreground` | `oklch(0.95 0.006 100)` | `oklch(0.23 0.012 160)` | Text, Beträge |
| `--muted` | `oklch(0.69 0.008 150)` | `oklch(0.51 0.012 160)` | Beschriftungen |
| `--border` | `oklch(0.285 0.006 160)` | `oklch(0.9 0.005 120)` | Linien |
| `--accent` | `oklch(0.8 0.07 172)` (Jade) | `oklch(0.47 0.075 175)` | Primäraktion, Fokus |
| `--success` | `oklch(0.75 0.1 155)` | `oklch(0.52 0.11 155)` | bezahlt / eingegangen |
| `--warning` | `oklch(0.81 0.1 80)` | `oklch(0.62 0.12 70)` | bald fällig |
| `--danger` | `oklch(0.69 0.14 25)` | `oklch(0.55 0.17 25)` | überfällig, Fehlbetrag |
| `--chart-income` | `oklch(0.65 0.11 215)` (Petrol) | `oklch(0.53 0.11 225)` | Einnahmen im Diagramm |
| `--chart-expense` | `oklch(0.665 0.125 58)` (Kupfer) | `oklch(0.6 0.125 55)` | Ausgaben im Diagramm |

Regeln
- Beträge sind standardmäßig in Vordergrundfarbe. Nur Fehlbeträge (negativ)
  werden rot, Einnahmen in Listen bekommen ein `+` – keine grünen Zahlenwände.
- Statusfarben erscheinen nur als kleine Punkte oder zurückhaltende Chips.
- Keine Verläufe, keine Glaseffekte, keine Leuchtschatten.

## Typografie

**Schibsted Grotesk** (Google Fonts, selbst gehostet über `next/font`).
Eigenständige Grotesk mit echten Tabellenziffern (`tnum`) – Beträge stehen in
Spalten exakt untereinander. Eine Familie für alles.

| Stufe | Größe / Zeilenhöhe | Gewicht | Einsatz |
| --- | --- | --- | --- |
| Kennzahl | 40 / 44 px, `-0.02em` | 600 | „Aktuell verfügbar“ (einmal pro Seite) |
| Kennzahl klein | 22 / 28 px | 600 | Sekundäre Summen |
| Seitentitel | 20 / 28 px | 600 | `h1` |
| Abschnitt | 15 / 22 px | 600 | `h2` in Panels |
| Text | 14 / 20 px | 400 | Standard |
| Klein | 12.5 / 18 px | 500 | Beschriftungen, Tabellenköpfe |

Alle Zahlen: `font-variant-numeric: tabular-nums` (Klasse `num`).

## Abstände & Raster

4-px-Basis. Innenabstand Panels 20 px (mobil 16 px), Abstand zwischen Panels
16 px, zwischen Seitenabschnitten 32 px. Inhaltsbreite max. 1200 px.

## Radien & Linien

`--radius: 6px` für Buttons und Felder, Panels 10 px, Chips 4 px.
Linien 1 px in `--border`, Trennlinien in Tabellen `--separator`.
Schatten nur bei schwebenden Elementen (Dialoge, Menüs).

## Komponenten

- **Panel** – Fläche mit Linie, Kopf (Titel, optionale Beschreibung, Aktion).
- **Tabellen** – für Listen mit Vergleichscharakter (Transaktionen, Abos,
  Fixkosten). Kopfzeile klein in `--muted`, Beträge rechtsbündig.
- **Formulare** – HeroUI `TextField`/`Select` mit sichtbarem Label über dem
  Feld, Fehlermeldung darunter. Beträge im deutschen Format („12,99“).
- **Dialoge** – HeroUI `Modal` für Erfassen/Bearbeiten, `AlertDialog` für
  kritische Aktionen (Löschen, Kündigen, Archivieren).
- **Status** – kleiner Farbpunkt + Text: überfällig (rot), heute/bald (gelb),
  geplant (neutral), bezahlt/eingegangen (grün), pausiert/gekündigt (neutral).
- **Leere Zustände** – ein Satz, was fehlt, und genau eine Aktion.

## Diagramme

Selbst gezeichnet (SVG), keine Diagrammbibliothek.
- Einnahmen/Ausgaben: gruppierte Säulen je Monat, Einnahmen Petrol, Ausgaben
  Kupfer (Paar mit dem Palette-Validator geprüft: Farbfehlsichtigkeit ΔE ≥ 16,
  Kontrast ≥ 3:1 in beiden Modi), 2 px Lücke, Radius 2 px oben, horizontale Hilfslinien in `--separator`,
  Achsenbeschriftung in `--muted`. Laufender Monat schraffiert-hell markiert
  als „bisher“. Werte per Tooltip/Fokus und als Tabelle zugänglich.
- Abo-Abbuchungen: Säulen der tatsächlichen Abbuchungen je Monat plus
  gestrichelte Linie für den rechnerischen Monatsdurchschnitt.

## Bewegung

Nur funktional: 120–160 ms für Hover/Fokus, Dialog-Ein-/Ausblenden über
HeroUI. `prefers-reduced-motion` wird respektiert.

## Icons

Phosphor Icons, Gewicht „regular“, 16–18 px, immer mit Text oder
`aria-label`. Keine Emojis.
