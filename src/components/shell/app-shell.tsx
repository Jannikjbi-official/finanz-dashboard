"use client";

import { Avatar, Breadcrumbs, Button, Dropdown, Kbd, Label, Link, Separator, Tooltip } from "@heroui/react";
import { LogOut, PanelLeftClose, PanelLeftOpen, Plus, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import type { CategoryOption } from "@/components/forms/fields";
import { signOut } from "@/lib/client/sign-out";
import { BackgroundServices } from "./background-services";
import { MOBILE_NAV, MoreIcon } from "./mobile-nav";
import { NAV_ITEMS, isActive, titleFor } from "./nav-items";
import { QuickAddProvider, useQuickAdd } from "./quick-add";

export interface ShellUser {
  name: string;
  image: string | null;
}

const COLLAPSE_KEY = "finanzen-sidebar-collapsed";

export function AppShell({
  user,
  categories,
  version,
  children,
}: {
  user: ShellUser;
  categories: CategoryOption[];
  version: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    // Alle Bereiche vorladen → Navigation fühlt sich wie eine native App an
    for (const item of NAV_ITEMS) router.prefetch(item.href);
    router.prefetch("/mehr");
  }, [router]);

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  }

  return (
    <QuickAddProvider categories={categories}>
      <div className="px-safe flex min-h-dvh">
        <Sidebar collapsed={collapsed} onToggle={toggle} version={version} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header user={user} />
          <main
            id="inhalt"
            className="mx-auto w-full max-w-7xl flex-1 px-4 pt-2 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-4 lg:pb-12"
          >
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
      <BackgroundServices />
    </QuickAddProvider>
  );
}

/* ── Sidebar (PC) ─────────────────────────────────────────────────────────── */

function Sidebar({ collapsed, onToggle, version }: { collapsed: boolean; onToggle: () => void; version: string }) {
  const pathname = usePathname();
  const { openExpense } = useQuickAdd();
  return (
    <aside
      aria-label="Hauptnavigation"
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-separator bg-surface/60 py-5 backdrop-blur-xl transition-[width] duration-300 ease-out lg:flex ${
        collapsed ? "w-[84px] px-3" : "w-[264px] px-4"
      }`}
    >
      <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
        <Link href="/" className="flex items-center gap-3 no-underline" aria-label="Finanzen – Dashboard">
          <Logo className="size-9 shrink-0" />
          {!collapsed && <span className="text-lg font-semibold tracking-tight text-foreground">Finanzen</span>}
        </Link>
        {!collapsed && (
          <Button isIconOnly size="sm" variant="ghost" aria-label="Seitenleiste einklappen" onPress={onToggle}>
            <PanelLeftClose className="size-4" />
          </Button>
        )}
      </div>

      <Button
        onPress={() => openExpense()}
        className={`mb-5 h-11 rounded-2xl ${collapsed ? "mx-auto w-11 px-0" : "w-full"}`}
        aria-label={collapsed ? "Neue Ausgabe" : undefined}
        isIconOnly={collapsed}
      >
        <Plus className="size-5" />
        {!collapsed && (
          <>
            Neue Ausgabe
            <Kbd className="ms-auto bg-white/15 text-current">
              <Kbd.Content>N</Kbd.Content>
            </Kbd>
          </>
        )}
      </Button>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={`group flex h-11 items-center gap-3 rounded-2xl text-sm font-medium no-underline transition-colors ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${
                active
                  ? "bg-accent/12 text-accent"
                  : "text-muted hover:bg-default hover:text-foreground data-[hovered=true]:bg-default"
              }`}
            >
              <item.icon className="size-5 shrink-0" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.href} delay={200}>
              {link}
              <Tooltip.Content placement="right">{item.label}</Tooltip.Content>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <Separator className="my-3" />
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
        {!collapsed && <span className="text-xs text-muted">Version {version}</span>}
        {collapsed && (
          <Button isIconOnly size="sm" variant="ghost" aria-label="Seitenleiste ausklappen" onPress={onToggle}>
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}

/* ── Header ──────────────────────────────────────────────────────────────── */

function Header({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const title = titleFor(pathname);
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-transparent bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:h-16 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Logo className="size-8 shrink-0 lg:hidden" />
          <h1 className="truncate text-lg font-semibold tracking-tight lg:hidden">{title}</h1>
          <Breadcrumbs className="hidden lg:flex">
            <Breadcrumbs.Item href="/">Finanzen</Breadcrumbs.Item>
            {pathname !== "/" && <Breadcrumbs.Item>{title}</Breadcrumbs.Item>}
          </Breadcrumbs>
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-muted xl:flex">
          <Kbd>
            <Kbd.Content>N</Kbd.Content>
          </Kbd>
          Neue Ausgabe
          <Kbd className="ms-2">
            <Kbd.Content>/</Kbd.Content>
          </Kbd>
          Suche
        </div>
        <UserMenu user={user} />
      </div>
    </header>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={`${user.name} – Konto-Menü`}
        className="flex min-h-11 items-center gap-2 rounded-full py-1 ps-1 pe-1 transition-colors hover:bg-default sm:pe-3"
      >
        <Avatar size="sm" aria-hidden="true">
          {user.image && <Avatar.Image alt="" src={user.image} />}
          <Avatar.Fallback>{initials || "?"}</Avatar.Fallback>
        </Avatar>
        <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{user.name}</span>
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-56">
        <Dropdown.Menu
          aria-label="Konto"
          onAction={(key) => {
            if (key === "settings") router.push("/einstellungen");
            if (key === "logout") void signOut(false);
          }}
        >
          <Dropdown.Section>
            <Dropdown.Item id="settings" textValue="Einstellungen">
              <Settings className="size-4 text-muted" />
              <Label>Einstellungen</Label>
            </Dropdown.Item>
            <Dropdown.Item id="logout" textValue="Abmelden" variant="danger">
              <LogOut className="size-4" />
              <Label>Abmelden</Label>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/* ── Bottom-Navigation (Handy) ───────────────────────────────────────────── */

function BottomNav() {
  const pathname = usePathname();
  const { openExpense } = useQuickAdd();
  const moreActive = !MOBILE_NAV.some((i) => isActive(pathname, i.href));

  const item = (href: string, label: string, Icon: typeof Plus, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium no-underline transition-colors ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
      {label}
    </Link>
  );

  const [first, second, third] = MOBILE_NAV;
  return (
    <nav
      aria-label="Navigation"
      className="pb-safe px-safe fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-surface/80 backdrop-blur-2xl lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {first && item(first.href, first.label, first.icon, isActive(pathname, first.href))}
        {second && item(second.href, second.label, second.icon, isActive(pathname, second.href))}
        <div className="flex flex-1 justify-center">
          <Button
            isIconOnly
            aria-label="Ausgabe hinzufügen"
            onPress={() => openExpense()}
            className="-mt-8 size-16 rounded-full shadow-[0_10px_30px_-8px_var(--accent)] ring-4 ring-background"
          >
            <Plus className="size-7" strokeWidth={2.6} />
          </Button>
        </div>
        {third && item(third.href, third.label, third.icon, isActive(pathname, third.href))}
        {item("/mehr", "Mehr", MoreIcon, moreActive)}
      </div>
    </nav>
  );
}
