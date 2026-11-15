import {
  BarChart3,
  CalendarClock,
  Gift,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
  Receipt,
  Settings,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ausgaben", label: "Ausgaben", icon: Receipt },
  { href: "/einnahmen", label: "Einnahmen", icon: Wallet },
  { href: "/abos", label: "Abos", icon: CalendarClock },
  { href: "/wunschliste", label: "Wunschliste", icon: Gift },
  { href: "/budgets", label: "Budgets & Kategorien", icon: PiggyBank },
  { href: "/statistik", label: "Statistik", icon: BarChart3 },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function titleFor(pathname: string): string {
  if (pathname === "/mehr") return "Mehr";
  return NAV_ITEMS.find((i) => isActive(pathname, i.href))?.label ?? "Finanzen";
}
