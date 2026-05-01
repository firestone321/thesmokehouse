export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "thesmokehouse.theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
export const LIGHT_THEME_COLOR = "#F4EFE6";
export const DARK_THEME_COLOR = "#161311";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
}

export function getSystemTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia(THEME_MEDIA_QUERY).matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}

export function getThemeBootstrapScript() {
  return `(() => {
    try {
      const key = ${JSON.stringify(THEME_STORAGE_KEY)};
      const theme = (() => {
        const stored = window.localStorage.getItem(key);
        if (stored === "light" || stored === "dark") {
          return stored;
        }

        return window.matchMedia(${JSON.stringify(THEME_MEDIA_QUERY)}).matches ? "dark" : "light";
      })();
      const root = document.documentElement;
      root.dataset.theme = theme;
      root.style.colorScheme = theme;
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute("content", theme === "dark" ? ${JSON.stringify(DARK_THEME_COLOR)} : ${JSON.stringify(LIGHT_THEME_COLOR)});
      }
    } catch {}
  })();`;
}
