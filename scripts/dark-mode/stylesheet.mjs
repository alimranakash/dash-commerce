/**
 * Turning a hand-written stylesheet into its dark-mode counterpart.
 *
 * Every rule that paints something gets a twin scoped to `[data-theme="dark"]`,
 * carrying the same properties with mapped colours. The twin is always exactly
 * one attribute selector more specific than the rule it shadows, which is what
 * lets the whole dark stylesheet sit at the top of `globals.css` and still win:
 * it can never be beaten by the light rule it was derived from.
 */

import { mapColor, parseColor } from "./color.mjs";
import { parseCss } from "./css.mjs";
import { roleForProperty } from "./roles.mjs";

const COLOR_LITERAL =
  /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b|\b(?:rgba?|hsla?)\([^()]*\)/g;

/** CSS colour keywords worth translating; the rest are too rare to matter. */
const KEYWORDS = {
  black: "#000000",
  white: "#ffffff"
};

/**
 * Custom properties a merchant sets inline, on the storefront theme scope or the
 * header shell.
 *
 * An inline `style` attribute beats any stylesheet, so these cannot be
 * re-declared - the *consumer* has to be rewritten instead. Only the surfaces
 * and the body text are swapped: `--store-primary` and `--sf-primary` are the
 * shop's own brand colour and stay exactly as the seller chose them.
 */
const MERCHANT_SURFACE_VARS = {
  "--sf-header-bg": "var(--dm-surface)",
  "--sf-header-color": "var(--dm-text)",
  "--sf-page-bg": "var(--dm-bg)",
  "--store-bg": "var(--dm-bg)",
  "--store-text": "var(--dm-text)"
};

const MERCHANT_VAR_REFERENCE = new RegExp(
  `var\\(\\s*(${Object.keys(MERCHANT_SURFACE_VARS).join("|")})\\s*(?:,[^()]*(?:\\([^()]*\\))?[^()]*)?\\)`,
  "g"
);

/**
 * @param {string} value
 * @param {import("./roles.mjs").Role} role
 * @returns {string | null} the rewritten value, or null when nothing changed
 */
export function darkenValue(value, role) {
  let changed = false;

  let next = value.replace(MERCHANT_VAR_REFERENCE, (match, name) => {
    changed = true;

    return MERCHANT_SURFACE_VARS[name];
  });

  next = next.replace(COLOR_LITERAL, (literal) => {
    const parsed = parseColor(literal);

    if (!parsed) {
      return literal;
    }

    const mapped = mapColor(parsed, role);

    if (mapped.toLowerCase() !== literal.toLowerCase()) {
      changed = true;
    }

    return mapped;
  });

  next = next.replace(/\b(white|black)\b/g, (word, keyword, offset, whole) => {
    // Only a standalone colour keyword, never the `white` inside a font name or
    // an `url(.../white.png)`.
    if (/url\(|["']/.test(whole)) {
      return word;
    }

    const parsed = parseColor(KEYWORDS[keyword]);
    const mapped = mapColor(parsed, role);

    if (mapped.toLowerCase() !== KEYWORDS[keyword]) {
      changed = true;
    }

    return mapped;
  });

  return changed ? next : null;
}

/**
 * Rewrites one selector so it only applies in dark mode.
 *
 * `[data-theme]` lands on `<html>`, so a descendant combinator covers almost
 * everything; the roots are the exceptions, because an ancestor combinator
 * cannot reach them.
 */
export function darkenSelector(selector) {
  return selector
    .split(",")
    .map((part) => {
      const trimmed = part.trim();

      if (!trimmed) {
        return trimmed;
      }

      if (trimmed === ":root" || trimmed.startsWith(":root")) {
        return trimmed.replace(/^:root/, ':root[data-theme="dark"]');
      }

      if (/^html\b/.test(trimmed)) {
        return trimmed.replace(/^html/, 'html[data-theme="dark"]');
      }

      return `[data-theme="dark"] ${trimmed}`;
    })
    .filter(Boolean)
    .join(",\n");
}

/**
 * @param {string} css the light-mode stylesheet
 * @param {{skipSelector?: (selector: string) => boolean}} [options]
 * @returns {{css: string, rules: number, declarations: number}}
 */
export function buildDarkStylesheet(css, options = {}) {
  const skipSelector = options.skipSelector ?? (() => false);
  const blocks = [];
  let rules = 0;
  let declarations = 0;

  function walk(nodes, wrap) {
    for (const node of nodes) {
      if (node.type === "atrule") {
        // Keyframe steps cannot be re-scoped by an ancestor selector, and the
        // two colours in them are on decorative pulses.
        if (/^(keyframes|font-face|property|counter-style|import|charset)$/.test(node.name)) {
          continue;
        }

        walk(node.nodes, [...wrap, `@${node.name} ${node.params}`]);
        continue;
      }

      if (node.type !== "rule" || !node.selector) {
        continue;
      }

      if (node.selector.includes("[data-theme") || skipSelector(node.selector)) {
        continue;
      }

      const body = [];

      for (const declaration of node.declarations) {
        const role = roleForProperty(declaration.prop);

        if (!role) {
          continue;
        }

        const value = darkenValue(declaration.value, role);

        if (value === null) {
          continue;
        }

        body.push(`  ${declaration.prop}: ${value};`);
      }

      if (body.length === 0) {
        continue;
      }

      rules += 1;
      declarations += body.length;

      const rule = `${darkenSelector(node.selector)} {\n${body.join("\n")}\n}`;

      blocks.push(wrap.length === 0 ? rule : wrapRule(rule, wrap));
    }
  }

  walk(parseCss(css), []);

  return { css: blocks.join("\n\n"), declarations, rules };
}

function wrapRule(rule, wrap) {
  let out = rule
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");

  for (let i = wrap.length - 1; i >= 0; i -= 1) {
    out = `${wrap[i]} {\n${out}\n}`;
  }

  return out;
}
