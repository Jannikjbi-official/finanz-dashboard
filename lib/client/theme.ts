"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
/** "system" folgt der Einstellung des Geraets. */
export type ThemePreference = Theme | "system";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.dataset.theme = theme;
}

function resolve(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
}

function stored(): ThemePreference {
  try {
    const value = localStorage.getItem("theme");
    return value === "light" || value === "system" ? value : "dark";
  } catch {
    return "dark";
  }
}

/** Dunkel ist Standard; die Wahl liegt nur im Browser (localStorage). */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const current = stored();
    setPreferenceState(current);
    setThemeState(resolve(current));
  }, []);

  // Bei "System" dem Geraet folgen, auch wenn es waehrenddessen umschaltet
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia(LIGHT_QUERY);
    const onChange = () => {
      const next = resolve("system");
      apply(next);
      setThemeState(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = (next: ThemePreference) => {
    const effective = resolve(next);
    apply(effective);
    setPreferenceState(next);
    setThemeState(effective);
    try {
      if (next === "dark") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Ohne Speicher gilt die Wahl nur bis zum Neuladen
    }
  };

  return { theme, preference, setPreference, setTheme: (next: Theme) => setPreference(next) };
}
