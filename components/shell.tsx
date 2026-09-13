"use client";

import { usePathname, useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Avatar,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { authClient } from "@/lib/auth-client";

const NAV = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/transaktionen", label: "Buchungen", icon: "list" },
  { href: "/abos", label: "Abos", icon: "repeat" },
  { href: "/einstellungen", label: "Einstellungen", icon: "cog" },
] as const;

function Icon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "grid") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    );
  }

  if (name === "list") {
    return (
      <svg {...common}>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    );
  }

  if (name === "repeat") {
    return (
      <svg {...common}>
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="M7 22l-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function Shell({
  user,
  children,
}: {
  user: { name?: string | null; email: string; image?: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col lg:flex-row">
      <aside className="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b border-default-100 bg-background/80 px-4 py-3 backdrop-blur lg:h-screen lg:w-64 lg:flex-col lg:items-stretch lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <div className="flex items-center gap-2 lg:mb-8 lg:px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 font-semibold text-primary">
            &euro;
          </div>
          <span className="hidden text-sm font-semibold tracking-tight lg:block">
            Finanzen
          </span>
        </div>

        <nav className="flex flex-1 gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <NextLink
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/15 font-medium text-primary"
                    : "text-default-500 hover:bg-default-100 hover:text-foreground",
                ].join(" ")}
              >
                <Icon name={item.icon} />
                {item.label}
              </NextLink>
            );
          })}
        </nav>

        <Dropdown placement="top-start">
          <DropdownTrigger>
            <Button
              variant="light"
              className="justify-start gap-2 px-2 lg:mt-4"
              startContent={
                <Avatar
                  size="sm"
                  name={(user.name ?? user.email).slice(0, 1).toUpperCase()}
                  src={user.image ?? undefined}
                />
              }
            >
              <span className="hidden max-w-[130px] truncate text-left text-xs lg:block">
                {user.name || user.email}
              </span>
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Konto">
            <DropdownItem key="email" isReadOnly className="opacity-70">
              {user.email}
            </DropdownItem>
            <DropdownItem key="logout" color="danger" onPress={logout}>
              Abmelden
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </aside>

      <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
