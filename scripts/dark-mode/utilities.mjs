/**
 * Dark-mode overrides for the Tailwind utilities this app writes.
 *
 * Two kinds of utility need completely different treatment.
 *
 * **Arbitrary values** (`bg-[#f5f6ff]`, 3,300 of them) carry a literal, so the
 * override restates the same property with the mapped colour.
 *
 * **Palette utilities** (`bg-emerald-50`, `text-rose-700`) compile in Tailwind v4
 * to `var(--color-emerald-50)`, which means the dark counterpart can be *derived*
 * from the family's own scale with `color-mix` instead of hard-coding 240 hex
 * values that would then drift out of step with Tailwind's palette.
 */

import { mapColor, parseColor } from "./color.mjs";
import { UTILITY_PROPERTIES, UTILITY_ROLES } from "./roles.mjs";

/** Families Tailwind ships as greys; they become the neutral dark ramp. */
const NEUTRAL_FAMILIES = new Set(["slate", "gray", "zinc", "neutral", "stone"]);

const FAMILIES = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose"
];

const PREFIXES = [
  "bg",
  "text",
  "border",
  "border-t",
  "border-r",
  "border-b",
  "border-l",
  "border-x",
  "border-y",
  "border-s",
  "border-e",
  "ring",
  "divide",
  "divide-x",
  "divide-y",
  "accent",
  "from",
  "to",
  "via",
  "fill",
  "stroke",
  "outline",
  "placeholder",
  "caret",
  "decoration",
  "shadow"
];

const TOKEN = new RegExp(
  String.raw`(?<![\w-])((?:[a-z][a-z0-9-]*:)*)(${PREFIXES.join("|")})-` +
    String.raw`(\[#[0-9a-fA-F]{3,8}\]|white|black|transparent|current|inherit|(?:${FAMILIES.join("|")})-\d{2,3})` +
    String.raw`(?:\/(\d{1,3}))?(?![\w[.-])`,
  "g"
);

/** Variants the codebase pairs with a colour, and the suffix each one needs. */
const VARIANT_SUFFIX = {
  active: ":active",
  after: "::after",
  before: "::before",
  checked: ":checked",
  disabled: ":disabled",
  empty: ":empty",
  focus: ":focus",
  "focus-visible": ":focus-visible",
  "focus-within": ":focus-within",
  hover: ":hover",
  placeholder: "::placeholder",
  "read-only": ":read-only",
  "peer-checked": null,
  "group-hover": null
};

/**
 * @param {string} source
 * @returns {Map<string, {prefix: string, value: string, alpha: string | null, variants: string[]}>}
 */
export function collectUtilities(source) {
  const found = new Map();

  for (const match of source.matchAll(TOKEN)) {
    const [full, rawVariants, prefix, value, alpha] = match;
    const variants = rawVariants ? rawVariants.split(":").filter(Boolean) : [];

    found.set(full, { alpha: alpha ?? null, prefix, value, variants });
  }

  return found;
}

/** CSS-escapes a class name the way Tailwind writes it into the stylesheet. */
function escapeClass(name) {
  return name.replace(/[.:#[\]/%(),!*+~='"^$|?{}<>&@\\]/g, (ch) => `\\${ch}`);
}

/**
 * Builds the selector for one utility token. Variants that need a companion
 * element (`group-hover`, `peer-checked`) are skipped rather than guessed at:
 * an override that lands on the wrong element is worse than no override.
 */
function selectorFor(token, variants) {
  let suffix = "";

  for (const variant of variants) {
    if (!(variant in VARIANT_SUFFIX)) {
      return null;
    }

    const part = VARIANT_SUFFIX[variant];

    if (part === null) {
      return null;
    }

    suffix += part;
  }

  return `.${escapeClass(token)}${suffix}`;
}

function withAlpha(value, alpha) {
  if (!alpha) {
    return value;
  }

  return `color-mix(in oklab, ${value} ${Number(alpha)}%, transparent)`;
}

/**
 * The dark value for a palette utility, expressed against Tailwind's own colour
 * variables so it tracks any future palette change.
 */
function paletteValue(role, family, shade) {
  const step = Number(shade);
  const neutral = NEUTRAL_FAMILIES.has(family);

  if (role === "bg") {
    if (step >= 400) {
      // A saturated fill still reads as one on a dark page.
      return null;
    }

    if (neutral) {
      return "var(--dm-surface-2)";
    }

    const strength = step <= 50 ? 16 : step <= 100 ? 22 : step <= 200 ? 28 : 34;

    return `color-mix(in oklab, var(--color-${family}-500) ${strength}%, var(--dm-surface))`;
  }

  if (role === "text") {
    if (step <= 400) {
      return null;
    }

    if (neutral) {
      return step >= 700 ? "var(--dm-text)" : "var(--dm-text-muted)";
    }

    return `var(--color-${family}-300)`;
  }

  if (role === "border") {
    if (step >= 400) {
      return null;
    }

    if (neutral) {
      return "var(--dm-border)";
    }

    return `color-mix(in oklab, var(--color-${family}-500) 32%, var(--dm-border))`;
  }

  return null;
}

/** The dark value for `white`, `black` and the keyword colours. */
function keywordValue(role, value) {
  if (value === "transparent" || value === "current" || value === "inherit") {
    return null;
  }

  if (value === "white") {
    // White *text* is sitting on a coloured fill and must not move; a white
    // *surface* is the single most common thing dark mode has to repaint.
    return role === "bg" ? "var(--dm-surface)" : role === "border" ? "var(--dm-border)" : null;
  }

  return role === "text" ? "var(--dm-text)" : null;
}

/**
 * Turns the scanned tokens into CSS.
 *
 * @param {Map<string, {prefix: string, value: string, alpha: string | null, variants: string[]}>} tokens
 * @returns {{css: string, count: number, skipped: string[]}}
 */
export function renderUtilityCss(tokens) {
  /** @type {Map<string, string[]>} */
  const byDeclaration = new Map();
  const skipped = [];
  let count = 0;

  // Emitted in this order so that, within one specificity, the later group wins
  // the same way it does in light mode: a child's own border beats the divider
  // colour it inherits from a parent.
  const order = [
    "divide",
    "from",
    "to",
    "via",
    "shadow",
    "ring",
    "outline",
    "accent",
    "caret",
    "decoration",
    "placeholder",
    "fill",
    "stroke",
    "bg",
    "border",
    "text"
  ];
  const sorted = [...tokens.entries()].sort((a, b) => {
    const rank = (entry) => {
      const base = entry[1].prefix.replace(/-(t|r|b|l|x|y|s|e)$/, "");

      return order.indexOf(base);
    };

    return rank(a) - rank(b) || a[0].localeCompare(b[0]);
  });

  for (const [token, meta] of sorted) {
    const base = meta.prefix.replace(/^(border|divide)-(t|r|b|l|x|y|s|e)$/, "$1");
    const role = UTILITY_ROLES[base];

    if (!role) {
      skipped.push(token);
      continue;
    }

    const selector = selectorFor(token, meta.variants);

    if (!selector) {
      skipped.push(token);
      continue;
    }

    let value = null;

    if (meta.value.startsWith("[#")) {
      const parsed = parseColor(meta.value.slice(1, -1));

      value = parsed ? mapColor(parsed, role === "accent" ? "accent" : role) : null;
    } else {
      const palette = /^([a-z]+)-(\d{2,3})$/.exec(meta.value);

      value = palette ? paletteValue(role, palette[1], palette[2]) : keywordValue(role, meta.value);
    }

    if (!value) {
      continue;
    }

    const properties = propertiesFor(meta.prefix);
    const body = properties.map((prop) => `${prop}: ${withAlpha(value, meta.alpha)};`).join(" ");
    const scoped = meta.prefix.startsWith("divide")
      ? `${selector} > :where(:not(:last-child))`
      : selector;
    const key = body;

    if (!byDeclaration.has(key)) {
      byDeclaration.set(key, []);
    }

    byDeclaration.get(key).push(scoped);
    count += 1;
  }

  const blocks = [];

  for (const [body, selectors] of byDeclaration) {
    const prefixed = selectors.map((selector) => `[data-theme="dark"] ${selector}`);

    blocks.push(`${prefixed.join(",\n")} {\n  ${body.split("; ").join(";\n  ")}\n}`);
  }

  return { count, css: blocks.join("\n\n"), skipped };
}

function propertiesFor(prefix) {
  const directional = /^border-(t|r|b|l|x|y|s|e)$/.exec(prefix);

  if (directional) {
    const sides = {
      b: ["border-bottom-color"],
      e: ["border-inline-end-color"],
      l: ["border-left-color"],
      r: ["border-right-color"],
      s: ["border-inline-start-color"],
      t: ["border-top-color"],
      x: ["border-left-color", "border-right-color"],
      y: ["border-top-color", "border-bottom-color"]
    };

    return sides[directional[1]];
  }

  if (prefix.startsWith("divide")) {
    return ["border-color"];
  }

  return UTILITY_PROPERTIES[prefix] ?? ["color"];
}
