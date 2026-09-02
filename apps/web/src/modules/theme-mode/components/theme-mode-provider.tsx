"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  DEFAULT_THEME_MODE,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  isThemeMode,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode
} from "../theme-mode";

type ThemeModeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Holds the theme preference for one surface and keeps `<html data-theme>` in
 * step with it.
 *
 * The attribute is written by the inline script in <head> long before this
 * mounts, so the provider starts from the light default and corrects itself in
 * an effect rather than reading storage during render: reading it during render
 * would make the server's HTML and the client's first pass disagree, which is a
 * hydration error on every page of the app.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);

    setPrefersDark(media.matches);

    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);

    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const stored = readStoredMode();

    if (stored) {
      setModeState(stored);
    }

    // A seller with the dashboard open in two tabs should not have to reload one
    // of them to stop seeing the theme they just switched away from.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      setModeState(isThemeMode(event.newValue) ? event.newValue : DEFAULT_THEME_MODE);
    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const resolved = resolveTheme(mode, prefersDark);

  useEffect(() => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, resolved);
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private windows and blocked storage: the choice still applies to this
      // page, it just will not survive a reload.
    }
  }, []);

  const value = useMemo<ThemeModeContextValue>(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

/**
 * Returns null outside a provider rather than throwing, so a component can be
 * rendered on a surface that has no theme control without crashing the page.
 */
export function useThemeMode(): ThemeModeContextValue | null {
  return useContext(ThemeModeContext);
}

function readStoredMode(): ThemeMode | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

    return isThemeMode(stored) ? stored : null;
  } catch {
    return null;
  }
}
