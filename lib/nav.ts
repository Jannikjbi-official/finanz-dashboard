export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Auf dem Handy in der unteren Leiste sichtbar. */
  primary?: boolean;
};

export type IconName =
  | "grid"
  | "list"
  | "repeat"
  | "chart"
  | "target"
  | "refund"
  | "wallet"
  | "exchange"
  | "cog"
  | "more";

export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Überblick",
    items: [
      { href: "/", label: "Dashboard", icon: "grid", primary: true },
      { href: "/auswertung", label: "Auswertung", icon: "chart", primary: true },
    ],
  },
  {
    title: "Verwalten",
    items: [
      { href: "/transaktionen", label: "Buchungen", icon: "list", primary: true },
      { href: "/abos", label: "Abos", icon: "repeat", primary: true },
      { href: "/budgets", label: "Budgets", icon: "target" },
      { href: "/konten", label: "Konten", icon: "wallet" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/daten", label: "Import / Export", icon: "exchange" },
      { href: "/einstellungen", label: "Einstellungen", icon: "cog" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const PRIMARY_NAV = NAV_ITEMS.filter((item) => item.primary);
export const SECONDARY_NAV = NAV_ITEMS.filter((item) => !item.primary);

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
