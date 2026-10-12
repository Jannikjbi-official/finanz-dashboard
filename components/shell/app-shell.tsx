"use client";

import {
  ArrowsClockwise,
  CaretDown,
  ChartLineUp,
  GearSix,
  Moon,
  Plus,
  Receipt,
  SignOut,
  Sun,
  Vault,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";
import { Button, Dropdown, Label } from "@heroui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { Lookups } from "@/components/forms/transaction-dialog";
import { authClient } from "@/lib/client/auth-client";
import { useTheme } from "@/lib/client/theme";
import { QuickAddProvider, useQuickAdd } from "./quick-add";

type NavItem = { href: string; label: string; short: string; icon: Icon; aliases?: string[] };

/** Bewusst kompakt: sechs Bereiche. Aliase sind Adressen der Vorversion. */
const NAV: NavItem[] = [
  { href: "/", label: "Übersicht", short: "Übersicht", icon: ChartLineUp, aliases: ["/app"] },
  { href: "/transaktionen", label: "Transaktionen", short: "Umsätze", icon: Receipt, aliases: ["/app/geld/buchungen"] },
  { href: "/abonnements", label: "Abonnements", short: "Abos", icon: ArrowsClockwise },
  { href: "/feste-kosten", label: "Feste Kosten", short: "Fixkosten", icon: Vault, aliases: ["/app/planung/fixkosten"] },
  { href: "/konten", label: "Konten", short: "Konten", icon: Wallet, aliases: ["/app/geld"] },
  { href: "/einstellungen", label: "Einstellungen", short: "Mehr", icon: GearSix, aliases: ["/app/einstellungen"] },
];

function isActive(item: NavItem, pathname: string) {
  const paths = [item.href, ...(item.aliases ?? [])];
  return paths.some((path) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`)));
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-[var(--radius)] outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-surface-secondary" />
        <path d="M9 21.5h14" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
        <path d="M11 17.5V12M16 17.5V9M21 17.5v-3.5" className="stroke-foreground" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Jannikjbi</span>
        <span className="block text-[15px] font-semibold">Finanzen</span>
      </span>
    </Link>
  );
}

function AddMenu({ compact = false }: { compact?: boolean }) {
  const { openTransaction, openRecurring } = useQuickAdd();
  return (
    <div className="flex">
      <Button size="sm" onPress={() => openTransaction("expense")} className={compact ? "" : "rounded-r-none"} aria-label="Ausgabe erfassen">
        <Plus weight="bold" className="size-4" />
        {compact ? null : "Ausgabe"}
      </Button>
      {!compact && (
        <Dropdown>
          <Button size="sm" isIconOnly aria-label="Weitere Erfassungsarten" className="rounded-l-none border-l border-accent-foreground/15">
            <CaretDown weight="bold" className="size-3.5" />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              onAction={(key) => {
                if (key === "income") openTransaction("income");
                if (key === "transfer") openTransaction("transfer");
                if (key === "subscription") openRecurring(null, { type: "expense", costType: "subscription" });
                if (key === "fixed") openRecurring(null, { type: "expense", costType: "rent" });
              }}
            >
              <Dropdown.Item id="income" textValue="Einnahme">
                <Label>Einnahme</Label>
              </Dropdown.Item>
              <Dropdown.Item id="transfer" textValue="Transfer">
                <Label>Transfer zwischen Konten</Label>
              </Dropdown.Item>
              <Dropdown.Item id="subscription" textValue="Abonnement">
                <Label>Abonnement</Label>
              </Dropdown.Item>
              <Dropdown.Item id="fixed" textValue="Feste Kosten">
                <Label>Feste Kosten</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      )}
    </div>
  );
}

function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      size="sm"
      variant="ghost"
      isIconOnly
      aria-label={next === "light" ? "Helles Design" : "Dunkles Design"}
      onPress={() => setTheme(next)}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function SignOutButton({ withLabel = false }: { withLabel?: boolean }) {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      isIconOnly={!withLabel}
      aria-label="Abmelden"
      onPress={async () => {
        await authClient.signOut();
        router.replace("/anmelden");
        router.refresh();
      }}
    >
      <SignOut className="size-4" />
      {withLabel && "Abmelden"}
    </Button>
  );
}

function Sidebar({ pathname, userName }: { pathname: string; userName: string }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-separator px-3 py-5 lg:flex">
      <div className="px-2">
        <Brand />
      </div>
      <nav aria-label="Hauptnavigation" className="mt-8 flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = isActive(item, pathname);
          const IconComponent = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-2.5 rounded-[var(--radius)] px-2.5 py-2 text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
                active ? "bg-surface-secondary font-medium text-foreground" : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              <IconComponent weight={active ? "fill" : "regular"} className={`size-[18px] ${active ? "text-accent" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-separator px-2 pt-4">
        <span className="truncate text-[13px] text-muted" title={userName}>
          {userName}
        </span>
        <div className="flex shrink-0">
          <ThemeButton />
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}

function MobileTabs({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-separator bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      {NAV.map((item) => {
        const active = isActive(item, pathname);
        const IconComponent = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 px-1 pb-1.5 pt-2 text-[10.5px] leading-tight outline-none focus-visible:bg-surface ${
              active ? "text-foreground" : "text-muted"
            }`}
          >
            <IconComponent weight={active ? "fill" : "regular"} className={`size-5 ${active ? "text-accent" : ""}`} />
            <span className="truncate">{item.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ lookups, userName, children }: { lookups: Lookups; userName: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <QuickAddProvider lookups={lookups}>
      <div className="flex min-h-dvh">
        <Sidebar pathname={pathname} userName={userName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-separator bg-background/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="lg:hidden">
              <Brand />
            </div>
            <div className="hidden text-[13px] text-muted lg:block">
              <TodayLabel today={lookups.today} />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="lg:hidden">
                <ThemeButton />
              </div>
              <div className="hidden sm:block">
                <AddMenu />
              </div>
              <div className="sm:hidden">
                <AddMenu compact />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">{children}</main>
        </div>
        <MobileTabs pathname={pathname} />
      </div>
    </QuickAddProvider>
  );
}

function TodayLabel({ today }: { today: string }) {
  const [year, month, day] = today.split("-").map(Number);
  const text = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
  return <span>{text}</span>;
}

export { SignOutButton, ThemeButton };
