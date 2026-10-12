"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.dataset.theme = theme;
}

/** Dunkel ist Standard; die Wahl liegt nur im Browser (localStorage). */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  const setTheme = (next: Theme) => {
    apply(next);
    setThemeState(next);
    try {
      if (next === "light") localStorage.setItem("theme", "light");
      else localStorage.removeItem("theme");
    } catch {
      // Ohne Speicher gilt die Wahl nur bis zum Neuladen
    }
  };

  return { theme, setTheme };
}
