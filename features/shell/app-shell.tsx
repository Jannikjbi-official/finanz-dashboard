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

        <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-[2px] supports-[backdrop-filter]:bg-paper/85">
          <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-4 sm:px-6">
            <Link href="/app" className="flex items-center" aria-label="Zur Lage">
              <span className="hidden sm:inline-flex">
                <Wordmark />
              </span>
              <span className="inline-flex sm:hidden">
                <Mark size={24} />
              </span>
            </Link>

            {/* Bereiche (ab lg in der Kopfzeile, darunter unten) */}
            <nav aria-label="Bereiche" className="hidden h-full items-stretch gap-1 lg:flex">
              {AREAS.map((entry) => {
                const active = area?.key === entry.key && !inSettings;
                return (
                  <Link
                    key={entry.key}
                    href={entry.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "relative flex items-center px-2.5 text-[14px] transition-colors",
                      active ? "font-medium text-ink" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {entry.label}
                    {active ? <span className="absolute inset-x-2.5 -bottom-px h-[2px] bg-ink" /> : null}
                  </Link>
                );
              })}
            </nav>

            <span className="truncate text-[15px] font-semibold lg:hidden">
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
            <nav aria-label="Unterbereiche" className="border-t border-line">
              <div className="mx-auto flex max-w-[1240px] gap-5 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6">
                {tabs.map((tab) => {
                  const active = tab.href === currentTab;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "relative flex h-10 shrink-0 items-center whitespace-nowrap text-[13px] transition-colors",
                        active ? "font-medium text-ink" : "text-ink-3 hover:text-ink",
                      )}
                    >
                      {tab.label}
                      {active ? <span className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" /> : null}
                    </Link>
                  );
                })}
              </div>
            </nav>
          ) : null}
        </header>

        <main id="inhalt" className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-16">
          {children}
        </main>

        {/* Untere Leiste auf Handy und Tablet */}
        <nav
          aria-label="Bereiche"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <div className="mx-auto grid h-16 max-w-xl grid-cols-5">
            {AREAS.map((entry) => {
              const Icon = ICONS[entry.key];
              const active = area?.key === entry.key && !inSettings;
              return (
                <Link
                  key={entry.key}
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex flex-col items-center justify-center gap-1 text-[11px]",
                    active ? "font-medium text-ink" : "text-ink-3",
                  )}
                >
                  <Icon size={21} weight={active ? "fill" : "regular"} />
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
