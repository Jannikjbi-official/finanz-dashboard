"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GearSix, Moon, SignOut, SunDim } from "@phosphor-icons/react/dist/ssr";
import { authClient } from "@/lib/auth-client";
import { cx } from "@/ui/cx";

type Theme = "light" | "dark";

/** Dunkel ist Standard; nur "hell" wird gespeichert. */
function applyTheme(theme: Theme) {
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try {
    if (theme === "light") localStorage.setItem("theme", "light");
    else localStorage.removeItem("theme");
  } catch {
    // Speicher gesperrt (privater Modus) - Wahl gilt dann nur fuer diese Seite
  }
}

const item =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-xs px-2.5 py-2 text-[14px] text-ink-2 outline-none data-[highlighted]:bg-sunken data-[highlighted]:text-ink";

export function UserMenu({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const initials = (user.name || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  async function logout() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Konto und Einstellungen"
        className="flex size-8 items-center justify-center rounded-full border border-line-strong bg-surface text-[12px] font-semibold text-ink-2 hover:border-ink-3 data-[state=open]:border-ink"
      >
        {initials || "?"}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-md border border-line bg-paper p-1.5 shadow-float"
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="truncate text-[14px] font-medium">{user.name || "Ohne Namen"}</p>
            <p className="truncate text-[12px] text-ink-3">{user.email}</p>
          </div>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item className={item} onSelect={() => router.push("/app/einstellungen")}>
            <GearSix size={17} /> Einstellungen
          </Menu.Item>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Label className="px-2.5 pb-1 pt-1.5 text-[12px] text-ink-3">Darstellung</Menu.Label>
          <div className="grid grid-cols-2 gap-1 px-1 pb-1">
            {(
              [
                { value: "dark", label: "Dunkel", Icon: Moon },
                { value: "light", label: "Hell", Icon: SunDim },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  applyTheme(value);
                  setTheme(value);
                }}
                aria-pressed={theme === value}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-xs py-2 text-[12px]",
                  theme === value ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-sunken",
                )}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item className={item} onSelect={logout}>
            <SignOut size={17} /> Abmelden
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
