/**
 * Informationsarchitektur des eingeloggten Bereichs - nach den Fragen, die
 * man an sein Geld stellt:
 *   Lage         Wie steht es gerade, was kommt, was sollte ich wissen?
 *   Geld         Wo ist mein Geld, was ist passiert?
 *   Planung      Was steht an?
 *   Entscheiden  Kann ich mir das leisten? Was waere wenn?
 *   Rueckblick   Wie hat es sich entwickelt?
 */

export type AreaKey = "lage" | "geld" | "planung" | "entscheiden" | "rueckblick";

export type Area = {
  key: AreaKey;
  label: string;
  href: string;
  tabs: Array<{ href: string; label: string }>;
};

export const AREAS: Area[] = [
  { key: "lage", label: "Lage", href: "/app", tabs: [] },
  {
    key: "geld",
    label: "Geld",
    href: "/app/geld",
    tabs: [
      { href: "/app/geld", label: "Konten" },
      { href: "/app/geld/buchungen", label: "Buchungen" },
      { href: "/app/geld/import", label: "Import" },
    ],
  },
  {
    key: "planung",
    label: "Planung",
    href: "/app/planung",
    tabs: [
      { href: "/app/planung", label: "Kalender" },
      { href: "/app/planung/fixkosten", label: "Fixkosten" },
      { href: "/app/planung/budgets", label: "Budgets" },
      { href: "/app/planung/geplant", label: "Geplant & erwartet" },
      { href: "/app/planung/ziele", label: "Ziele" },
    ],
  },
  {
    key: "entscheiden",
    label: "Entscheiden",
    href: "/app/entscheiden",
    tabs: [
      { href: "/app/entscheiden", label: "Kann ich mir das leisten?" },
      { href: "/app/entscheiden/sandbox", label: "Sandbox" },
    ],
  },
  {
    key: "rueckblick",
    label: "Rückblick",
    href: "/app/rueckblick",
    tabs: [
      { href: "/app/rueckblick", label: "Monatsbericht" },
      { href: "/app/rueckblick/analysen", label: "Analysen" },
      { href: "/app/rueckblick/zeitreise", label: "Zeitreise" },
    ],
  },
];

export const SETTINGS_TABS = [
  { href: "/app/einstellungen", label: "Allgemein" },
  { href: "/app/einstellungen/kategorien", label: "Kategorien" },
  { href: "/app/einstellungen/daten", label: "Daten & Datenschutz" },
  { href: "/app/einstellungen/sicherheit", label: "Anmeldung & Sicherheit" },
];

export function areaFor(pathname: string): Area | null {
  if (pathname === "/app") return AREAS[0];
  return AREAS.slice(1).find((area) => pathname === area.href || pathname.startsWith(`${area.href}/`)) ?? null;
}

/** Aktiver Unterreiter: exakter Treffer, sonst der laengste passende Praefix. */
export function activeTab(pathname: string, tabs: Array<{ href: string }>) {
  const exact = tabs.find((tab) => tab.href === pathname);
  if (exact) return exact.href;
  return tabs
    .filter((tab) => pathname.startsWith(`${tab.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
