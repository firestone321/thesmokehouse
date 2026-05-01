"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreference] = useState<Theme | null>(() => getStoredTheme());
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === "undefined") {
      return "light";
    }

    const currentTheme = document.documentElement.dataset.theme;
    return currentTheme === "light" || currentTheme === "dark" ? currentTheme : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
    const syncTheme = (nextTheme: Theme) => {
      setThemeState(nextTheme);
      applyTheme(nextTheme);
    };

    if (themePreference) {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
      syncTheme(themePreference);
      return;
    }

    window.localStorage.removeItem(THEME_STORAGE_KEY);
    syncTheme(getSystemTheme());

    const handleChange = (event: MediaQueryListEvent) => {
      syncTheme(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themePreference]);

  const themeValue = useMemo<ThemeContextValue>(() => {
    const setTheme = (nextTheme: Theme) => {
      setThemePreference(nextTheme);
    };

    const toggleTheme = () => {
      const currentTheme = themePreference ?? getSystemTheme();
      setThemePreference(currentTheme === "dark" ? "light" : "dark");
    };

    return {
      theme,
      setTheme,
      toggleTheme,
    };
  }, [theme, themePreference]);

  return <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within AppProvider");
  }

  return context;
}
