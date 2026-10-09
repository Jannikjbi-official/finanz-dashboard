"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDots,
  ClockCounterClockwise,
  Gauge,
  Plus,
  Scales,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import { AREAS, SETTINGS_TABS, activeTab, areaFor, type AreaKey } from "@/lib/navigation";
import { Wordmark, Mark } from "@/ui/logo";
import { Button } from "@/ui/button";
import { cx } from "@/ui/cx";
import { ToastProvider } from "@/ui/toast";
import { TransactionSheet } from "@/features/shared/transaction-sheet";
import type { AccountOption, CategoryOption } from "@/features/shared/types";
import { UserMenu } from "./user-menu";

const ICONS: Record<AreaKey, typeof Gauge> = {
  lage: Gauge,
  geld: Wallet,
  planung: CalendarDots,
  entscheiden: Scales,
  rueckblick: ClockCounterClockwise,
};

export function AppShell({
  user,
  categories,
  accounts,
  today,
  children,
}: {
  user: { name: string; email: string };
  categories: CategoryOption[];
  accounts: AccountOption[];
  today: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [capture, setCapture] = useState(false);

  const area = areaFor(pathname);
  const inSettings = pathname.startsWith("/app/einstellungen");
  const tabs = inSettings ? SETTINGS_TABS : (area?.tabs ?? []);
  const currentTab = activeTab(pathname, tabs);

  return (
    <ToastProvider>
      <div className="min-h-dvh">
        <a href="#inhalt" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
          Zum Inhalt springen
        </a>

        <header className="sticky top-0 z-40 bg-paper/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-4 sm:px-6">
            <Link href="/app" className="flex items-center" aria-label="Zur Lage">
              <span className="hidden sm:inline-flex">
                <Wordmark />
              </span>
              <span className="inline-flex sm:hidden">
                <Mark size={24} />
              </span>
            </Link>

            {/* Bereiche (ab lg in der Kopfzeile, darunter unten) */}
            <nav aria-label="Bereiche" className="hidden items-center gap-1 rounded-full bg-surface p-1 lg:flex">
              {AREAS.map((entry) => {
                const active = area?.key === entry.key && !inSettings;
                return (
                  <Link
                    key={entry.key}
                    href={entry.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex h-9 items-center rounded-full px-4 text-[14px] font-semibold transition-colors",
                      active ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {entry.label}
                  </Link>
                );
              })}
            </nav>

            <span className="truncate text-[17px] font-bold tracking-[-0.02em] lg:hidden">
              {inSettings ? "Einstellungen" : (area?.label ?? "")}
            </span>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => setCapture(true)} aria-label="Buchung erfassen">
                <Plus size={15} weight="bold" />
                <span className="hidden sm:inline">Erfassen</span>
              </Button>
              <UserMenu user={user} />
            </div>
          </div>

          {tabs.length > 0 ? (
            <nav aria-label="Unterbereiche">
              <div className="mx-auto flex max-w-[1240px] gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:px-6">
                {tabs.map((tab) => {
                  const active = tab.href === currentTab;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                        active ? "bg-accent text-accent-ink" : "bg-surface text-ink-2 hover:text-ink",
                      )}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          ) : null}
        </header>

        <main id="inhalt" className="mx-auto max-w-[1240px] px-4 pb-32 pt-4 sm:px-6 sm:pt-6 lg:pb-16">
          {children}
        </main>

        {/* Untere Leiste auf Handy und Tablet */}
        <nav
          aria-label="Bereiche"
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden"
        >
          <div className="mx-auto grid h-16 max-w-md grid-cols-5 rounded-full border border-line bg-surface/90 p-1.5 shadow-float backdrop-blur-xl">
            {AREAS.map((entry) => {
              const Icon = ICONS[entry.key];
              const active = area?.key === entry.key && !inSettings;
              return (
                <Link
                  key={entry.key}
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={entry.label}
                  className={cx(
                    "flex flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-bold transition-colors",
                    active ? "bg-accent text-accent-ink" : "text-ink-3",
                  )}
                >
                  <Icon size={20} weight={active ? "fill" : "regular"} />
                  {entry.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <TransactionSheet
          key={capture ? "open" : "closed"}
          open={capture}
          onOpenChange={setCapture}
          categories={categories}
          accounts={accounts}
          today={today}
        />
      </div>
    </ToastProvider>
  );
}
