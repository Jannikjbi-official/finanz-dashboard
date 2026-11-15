import { CalendarClock, LayoutDashboard, LayoutGrid, Receipt } from "lucide-react";
import type { NavItem } from "./nav-items";

/** Bottom-Navigation: Dashboard, Ausgaben, [+], Abos, Mehr */
export const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ausgaben", label: "Ausgaben", icon: Receipt },
  { href: "/abos", label: "Abos", icon: CalendarClock },
];

export const MoreIcon = LayoutGrid;
