"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Desktop, GearSix, Moon, SignOut, SunDim } from "@phosphor-icons/react/dist/ssr";
import { authClient } from "@/lib/auth-client";
import { cx } from "@/ui/cx";

type Theme = "system" | "light" | "dark";

function applyTheme(theme: Theme) {
  try {
    if (theme === "system") {
      localStorage.removeItem("theme");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("theme", theme);
      document.documentElement.dataset.theme = theme;
    }
  } catch {
    // Speicher gesperrt (privater Modus) - Wahl gilt dann nur fuer diese Seite
    if (theme !== "system") document.documentElement.dataset.theme = theme;
  }
}

const item =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-xs px-2.5 py-2 text-[14px] text-ink-2 outline-none data-[highlighted]:bg-sunken data-[highlighted]:text-ink";

export function UserMenu({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    setTheme(stored === "light" || stored === "dark" ? stored : "system");
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
          <div className="grid grid-cols-3 gap-1 px-1 pb-1">
            {(
              [
                { value: "light", label: "Hell", Icon: SunDim },
                { value: "dark", label: "Dunkel", Icon: Moon },
                { value: "system", label: "System", Icon: Desktop },
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
                  theme === value ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken",
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
