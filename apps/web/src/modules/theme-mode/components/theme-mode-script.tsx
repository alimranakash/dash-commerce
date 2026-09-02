import { THEME_INIT_SCRIPT } from "../theme-mode";

/**
 * Applies the stored theme before the browser paints.
 *
 * Rendered as the first thing inside <body> so it runs while the document is
 * still being parsed: `document.documentElement` already exists, and nothing has
 * been painted yet, so a reader who chose dark never sees the white page flash
 * that would otherwise show on every full document load until React hydrates.
 *
 * Not a `next/script` - that defers, which is the one thing this must not do.
 */
export function ThemeModeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
