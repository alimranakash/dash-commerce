/**
 * The one place that decides what "dark mode" means for this app.
 *
 * A preference is one of three values, and only two of them are ever written to
 * the document: `system` resolves against `prefers-color-scheme` at read time and
 * stamps the *result*, so every stylesheet only has to answer one question -
 * `[data-theme="dark"]`, yes or no - instead of duplicating itself under a media
 * query as well.
 *
 * The default is `light`, deliberately. Dark mode is additive here: with nothing
 * stored, no attribute is stamped, no generated rule matches, and every surface
 * renders exactly as it did before any of this existed. A seller or a shopper
 * opts in, and `system` is there for anyone who wants their OS to decide.
 */

export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/** What actually reaches the DOM once `system` has been resolved. */
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME_MODE: ThemeMode = "light";

/**
 * Shared by every surface, so a seller who picks dark in the dashboard keeps it
 * in the admin console. A storefront is a different origin from `app.`, so a
 * shop's visitors never inherit the seller's choice.
 */
export const THEME_STORAGE_KEY = "storeim.theme-mode";

export const THEME_ATTRIBUTE = "data-theme";

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }

  return mode;
}

/**
 * Runs before first paint, inlined into <head>.
 *
 * Without it a dark-mode reader gets a white flash on every navigation that
 * starts a new document: React cannot restore the preference until hydration,
 * which is several hundred milliseconds too late. It is deliberately tiny and
 * total - a browser with storage blocked falls through to the light default
 * rather than throwing and stopping the rest of the page from running.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(m!=="light"&&m!=="dark"&&m!=="system"){m=${JSON.stringify(DEFAULT_THEME_MODE)};}
var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE
)},d?"dark":"light");}catch(e){}})();`;
