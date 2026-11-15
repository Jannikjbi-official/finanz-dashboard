"use client";

import { useTheme } from "@heroui/react";
import { createContext, use, useEffect, type ReactNode } from "react";

export type ThemeChoice = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeChoice;
  resolvedTheme: "light" | "dark" | undefined;
  setTheme: (theme: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const META_COLORS = { dark: "#0b0c12", light: "#f7f8fb" } as const;

/** Ein einziger Theme-Controller für die ganze App (HeroUI `useTheme`). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme, setTheme } = useTheme("dark");

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    const root = document.documentElement;
    root.classList.remove(resolvedTheme === "dark" ? "light" : "dark");
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((m) => (m.content = META_COLORS[resolvedTheme]));
  }, [resolvedTheme]);

  return (
    <ThemeContext
      value={{
        theme: (theme as ThemeChoice) ?? "dark",
        resolvedTheme: resolvedTheme as "light" | "dark" | undefined,
        setTheme: (t) => setTheme(t),
      }}
    >
      {children}
    </ThemeContext>
  );
}

export function useAppTheme() {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error("useAppTheme außerhalb von ThemeProvider");
  return ctx;
}

/** Läuft vor dem ersten Paint – verhindert Aufblitzen des falschen Themes. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('heroui-theme')||'dark';if(t==='system'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);r.setAttribute('data-theme',t);var a=localStorage.getItem('finanzen-accent');if(a)r.style.setProperty('--accent',a)}catch(e){document.documentElement.classList.add('dark')}})()`;
