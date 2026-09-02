"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { THEME_MODES, type ThemeMode } from "../theme-mode";
import { useThemeMode } from "./theme-mode-provider";

const ICONS: Record<ThemeMode, LucideIcon> = {
  dark: Moon,
  light: Sun,
  system: Monitor
};

const LABELS: Record<ThemeMode, string> = {
  dark: "Dark",
  light: "Light",
  system: "System"
};

/**
 * One button that steps Light -> Dark -> System.
 *
 * A cycling button rather than a menu because it has to sit in four different
 * headers — the dashboard topbar, the admin console and three storefront
 * templates whose colours the seller chose — and a popover would need styling
 * for each. The class and icon size are the caller's for the same reason
 * [`WishlistHeaderLink`](../../wishlist/components/wishlist-header-link.tsx)
 * takes them.
 *
 * The label names the state being switched *to*, so a keyboard or screen-reader
 * user learns what pressing it will do rather than only what it currently is.
 */
export function ThemeModeToggle({
  className = "theme-mode-toggle",
  iconClassName,
  iconSize
}: {
  className?: string | undefined;
  iconClassName?: string | undefined;
  iconSize?: number | undefined;
}) {
  const theme = useThemeMode();
  const [mounted, setMounted] = useState(false);

  // The stored preference is unknown until after hydration, so the icon has to
  // render as the light default on the first pass in the browser exactly as it
  // did on the server, and correct itself immediately afterwards.
  useEffect(() => setMounted(true), []);

  if (!theme) {
    return null;
  }

  const mode = mounted ? theme.mode : "light";
  const next = THEME_MODES[(THEME_MODES.indexOf(theme.mode) + 1) % THEME_MODES.length] ?? "light";
  const Icon = ICONS[mode];

  return (
    <button
      aria-label={`Theme: ${LABELS[mode]}. Switch to ${LABELS[next].toLowerCase()}.`}
      className={className}
      onClick={() => theme.setMode(next)}
      title={`Theme: ${LABELS[mode]}`}
      type="button"
    >
      <Icon
        className={iconClassName ?? "h-4 w-4"}
        {...(iconSize !== undefined ? { size: iconSize } : {})}
      />
    </button>
  );
}
