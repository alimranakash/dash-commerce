/**
 * Deciding what a colour is *for*.
 *
 * `#ececf5` is a panel in one rule and a hairline in the next, and the dark
 * counterpart is completely different in each case, so every literal has to be
 * classified before it can be mapped. In plain CSS the property name says it; in
 * Tailwind the utility prefix does.
 */

/** Properties whose colour paints a surface. */
const SURFACE_PROPS = /^(background|background-color|background-image)$/;

/** Properties whose colour is a foreground mark. */
const INK_PROPS =
  /^(color|fill|stroke|caret-color|-webkit-text-fill-color|text-decoration-color|text-emphasis-color|-webkit-text-stroke-color)$/;

/** Properties whose colour is a hairline. */
const LINE_PROPS =
  /^(border(-(top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?(-color)?|border-color|outline|outline-color|column-rule|column-rule-color|text-decoration|scrollbar-color)$/;

/** Properties whose colour is a shadow. */
const SHADOW_PROPS = /^(box-shadow|text-shadow|-webkit-box-shadow|filter|backdrop-filter)$/;

/**
 * Custom properties, most specific pattern first. `--accent-foreground` has to
 * be tested before `--accent`, or the white that sits *on* the brand fill gets
 * mapped as if it were the fill.
 */
const CUSTOM_PROPERTY_ROLES = [
  [/-(foreground|on-accent)$/, "keep"],
  [/(^|-)(border|divider|rule|hairline|outline)(-|$)/, "border"],
  [/(^|-)shadow(-|$)/, "shadow"],
  [/(^|-)(bg|background|surface|blush|cream|wash|tile-surface|panel|card|inset)(-|$)/, "bg"],
  [
    /(^|-)(accent|primary|secondary|brand|rose|blue|purple|green|red|amber|highlight|strong)(-|$)/,
    "accent"
  ],
  [
    /(^|-)(ink|fg|foreground|text|muted|title|label|heading|caption|name|price|compare|icon)(-|$)/,
    "text"
  ]
];

/**
 * @param {string} prop
 * @returns {"bg" | "text" | "border" | "shadow" | "accent" | "keep" | null}
 */
export function roleForProperty(prop) {
  const name = prop.trim().toLowerCase();

  if (name.startsWith("--")) {
    for (const [pattern, role] of CUSTOM_PROPERTY_ROLES) {
      if (pattern.test(name)) {
        return role;
      }
    }

    // An unrecognised custom property is left to the accent rule, which only
    // lifts a colour far enough to be legible and never repaints it. Guessing
    // "surface" here would turn an unknown brand colour into grey.
    return "accent";
  }

  if (SURFACE_PROPS.test(name)) {
    return "bg";
  }

  if (INK_PROPS.test(name)) {
    return "text";
  }

  if (LINE_PROPS.test(name)) {
    return "border";
  }

  if (SHADOW_PROPS.test(name)) {
    return "shadow";
  }

  if (name === "accent-color") {
    return "accent";
  }

  return null;
}

/**
 * Tailwind utility prefixes. Only the ones this codebase actually writes are
 * listed; `npm run verify:dark-mode` fails if a new one appears, rather than
 * letting it slip through unthemed.
 */
export const UTILITY_ROLES = {
  accent: "accent",
  bg: "bg",
  border: "border",
  caret: "text",
  decoration: "text",
  divide: "border",
  fill: "text",
  from: "bg",
  outline: "border",
  placeholder: "text",
  ring: "border",
  shadow: "shadow",
  stroke: "text",
  text: "text",
  to: "bg",
  via: "bg"
};

/** The CSS each utility prefix declares, so the override can restate it. */
export const UTILITY_PROPERTIES = {
  accent: ["accent-color"],
  bg: ["background-color"],
  border: ["border-color"],
  caret: ["caret-color"],
  decoration: ["text-decoration-color"],
  divide: ["border-color"],
  fill: ["fill"],
  from: ["--tw-gradient-from"],
  outline: ["outline-color"],
  placeholder: ["color"],
  ring: ["--tw-ring-color"],
  shadow: ["--tw-shadow-color"],
  stroke: ["stroke"],
  text: ["color"],
  to: ["--tw-gradient-to"],
  via: ["--tw-gradient-via"]
};
