"use client";

import { usePathname, useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Avatar,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  useDisclosure,
} from "@heroui/react";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/icon";
import { Logo, LogoMark } from "@/components/logo";
import {
  NAV_GROUPS,
  NAV_ITEMS,
  PRIMARY_NAV,
  SECONDARY_NAV,
  isActive,
} from "@/lib/nav";

type User = { name?: string | null; email: string; image?: string | null };

export function Shell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const drawer = useDisclosure();

  const current = NAV_ITEMS.find((item) => isActive(pathname, item.href));
  const moreActive = SECONDARY_NAV.some((item) => isActive(pathname, item.href));

  async function logout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (user.name ?? user.email).slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-screen">
      {/* ---------- Sidebar ab lg ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-default-100/70 bg-background/60 px-3 py-6 backdrop-blur lg:flex">
        <div className="mb-7 px-2">
          <Logo id="sidebar" subtitle="Privates Dashboard" />
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-tiny font-medium uppercase tracking-wider text-default-400">
                {group.title}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(pathname, item.href)}
                />
              ))}
            </div>
          ))}
        </nav>

        <UserMenu user={user} initials={initials} onLogout={logout} />
      </aside>

      {/* ---------- Inhalt ---------- */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Kopfzeile nur auf kleinen Screens */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-default-100/70 bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <LogoMark size={30} id="topbar" />
            <span className="text-sm font-semibold">
              {current?.label ?? "Finanzen"}
            </span>
          </div>

          <UserMenu
            user={user}
            initials={initials}
            onLogout={logout}
            compact
          />
        </header>

        <main className="mx-auto w-full max-w-[1300px] flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      {/* ---------- Untere Leiste auf dem Handy ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-default-100/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <NextLink
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.65rem] transition-colors ${
                active ? "text-primary" : "text-default-400"
              }`}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </NextLink>
          );
        })}

        <button
          type="button"
          onClick={drawer.onOpen}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.65rem] transition-colors ${
            moreActive ? "text-primary" : "text-default-400"
          }`}
        >
          <Icon name="more" size={20} />
          Mehr
        </button>
      </nav>

      <Drawer
        isOpen={drawer.isOpen}
        onOpenChange={drawer.onOpenChange}
        placement="bottom"
        size="xs"
      >
        <DrawerContent>
          {(close) => (
            <>
              <DrawerHeader className="text-sm">Weitere Bereiche</DrawerHeader>
              <DrawerBody className="gap-1 pb-8">
                {SECONDARY_NAV.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    onClick={close}
                  />
                ))}
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <NextLink
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-primary/15 font-medium text-primary"
          : "text-default-500 hover:bg-default-100/60 hover:text-foreground"
      }`}
    >
      <Icon name={icon} />
      {label}
    </NextLink>
  );
}

function UserMenu({
  user,
  initials,
  onLogout,
  compact,
}: {
  user: User;
  initials: string;
  onLogout: () => void;
  compact?: boolean;
}) {
  return (
    <Dropdown placement={compact ? "bottom-end" : "top-start"}>
      <DropdownTrigger>
        <Button
          variant="light"
          isIconOnly={compact}
          className={compact ? "" : "mt-4 justify-start gap-2 px-2"}
          startContent={
            compact ? undefined : (
              <Avatar size="sm" name={initials} src={user.image ?? undefined} />
            )
          }
        >
          {compact ? (
            <Avatar size="sm" name={initials} src={user.image ?? undefined} />
          ) : (
            <span className="max-w-[130px] truncate text-left text-xs">
              {user.name || user.email}
            </span>
          )}
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Konto">
        <DropdownItem key="email" isReadOnly className="opacity-70">
          {user.email}
        </DropdownItem>
        <DropdownItem key="logout" color="danger" onPress={onLogout}>
          Abmelden
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
