/**
 * Colour maths for the dark-mode generator.
 *
 * The dashboard, admin console and storefront were all written against literal
 * light-mode colours - 3,300 Tailwind arbitrary values in TSX and 1,500 more in
 * `globals.css`. Rewriting them into tokens would touch every file in the app,
 * so dark mode is instead produced by *mapping* each of those literals to a dark
 * counterpart and emitting the result as extra rules scoped to
 * `[data-theme="dark"]`. Light mode keeps every declaration it already had.
 *
 * The mapping is role-aware rather than a blanket inversion: what a colour
 * should become depends entirely on whether it paints a surface, a piece of text
 * or a hairline, so `#ececf5` becomes a border in one place and a panel in
 * another. Roles come from the utility prefix (`text-` vs `bg-`) or, in plain
 * CSS, from the property name.
 */

/** @typedef {"bg" | "text" | "border" | "shadow" | "accent" | "keep"} ColorRole */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function parseColor(raw) {
  const value = raw.trim();

  if (HEX.test(value)) {
    return fromHex(value);
  }

  const functional = /^(rgba?|hsla?)\(([^)]*)\)$/i.exec(value);

  if (!functional) {
    return null;
  }

  const fn = functional[1].toLowerCase();
  const parts = functional[2]
    .split(/[,/\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  const alpha = parts.length > 3 ? parseAlpha(parts[3]) : 1;

  if (fn.startsWith("rgb")) {
    const [r, g, b] = parts.slice(0, 3).map((part) => channel(part));

    if ([r, g, b].some((n) => Number.isNaN(n))) {
      return null;
    }

    return { ...rgbToHsl(r, g, b), a: alpha };
  }

  const h = Number.parseFloat(parts[0]);
  const s = Number.parseFloat(parts[1]) / 100;
  const l = Number.parseFloat(parts[2]) / 100;

  if ([h, s, l].some((n) => Number.isNaN(n))) {
    return null;
  }

  return { a: alpha, h: ((h % 360) + 360) % 360, l, s };
}

function parseAlpha(part) {
  if (part.endsWith("%")) {
    return Number.parseFloat(part) / 100;
  }

  const parsed = Number.parseFloat(part);

  return Number.isNaN(parsed) ? 1 : parsed;
}

function channel(part) {
  return part.endsWith("%")
    ? Math.round((Number.parseFloat(part) / 100) * 255)
    : Number.parseInt(part, 10);
}

function fromHex(value) {
  let hex = value.slice(1);

  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;

  return { ...rgbToHsl(r, g, b), a };
}

export function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, l, s: 0 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;

  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }

  return { h: h * 60, l, s };
}

export function hslToHex(h, s, l, a = 1) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const lig = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  const sector = Math.floor(hue / 60) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x]
  ][sector];
  const to255 = (n) => Math.round((n + m) * 255);
  const hex = `#${[to255(r), to255(g), to255(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;

  if (a >= 1) {
    return hex;
  }

  return `${hex}${Math.round(clamp(a, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * The dark palette's spine. Colours that carry no tint of their own land on one
 * cool hue, so that hundreds of independently chosen near-whites collapse into a
 * single coherent set of greys instead of drifting apart the way they do in
 * light mode.
 */
const NEUTRAL_HUE = 232;

/**
 * Decisions are made on *chroma* - `max - min` of the RGB channels - never on
 * HSL saturation. Saturation is meaningless near the ends of the lightness
 * scale: `#f5f6ff`, a page background four steps off white, is fully saturated
 * by that measure and would have been mapped to a vivid blue.
 */
const NEUTRAL_CHROMA = 0.02;

/** Below this a colour reads as grey rather than as a tint with intent. */
const TINT_CHROMA = 0.1;

/** Above this it is a brand or status colour whose hue is the whole point. */
const SIGNAL_CHROMA = 0.25;

function chromaOf(h, s, l) {
  return (1 - Math.abs(2 * clamp(l, 0, 1) - 1)) * clamp(s, 0, 1);
}

/**
 * Rebuilds a colour from a hue, a target chroma and a target lightness. HSL
 * saturation is derived rather than carried over, which is what keeps a tint
 * recognisable after its lightness has moved by half the scale.
 */
function fromChroma(h, c, l, a) {
  const lightness = clamp(l, 0, 1);
  const span = 1 - Math.abs(2 * lightness - 1);
  const saturation = span === 0 ? 0 : clamp(c / span, 0, 1);

  return hslToHex(h, saturation, lightness, a);
}

function hueOf(h, c) {
  return c < NEUTRAL_CHROMA ? NEUTRAL_HUE : h;
}

/**
 * Maps one light-mode colour to its dark-mode counterpart.
 *
 * @param {{h: number, s: number, l: number, a: number}} color
 * @param {"bg" | "text" | "border" | "shadow" | "accent" | "keep"} role
 * @returns {string} a hex or 8-digit hex string
 */
export function mapColor(color, role) {
  const { a, h, l, s } = color;

  if (a === 0 || role === "keep") {
    return hslToHex(h, s, l, a);
  }

  const c = chromaOf(h, s, l);

  switch (role) {
    case "bg":
      return mapSurface(h, c, l, a);
    case "accent":
      return mapAccent(h, c, l, a);
    case "border":
      return mapLine(h, c, l, a);
    case "shadow":
      return mapShadow(h, c, l, a);
    default:
      return mapInk(h, c, l, a);
  }
}

/**
 * Surfaces. Light mode stacks white cards on a faintly tinted page; dark mode
 * has to invert the stacking *order*, not merely the lightness - a card must
 * stay above the page it sits on. A plain `1 - l` inversion gets that backwards,
 * turning the whitest source into the darkest result, so the near-whites are
 * instead spread across a narrow dark band in the order they already had.
 */
function mapSurface(h, c, l, a) {
  if (l >= 0.86) {
    const t = (l - 0.86) / 0.14;

    // Chroma is amplified on the way down: a tint that reads clearly against
    // white is invisible against near-black at the same strength.
    return fromChroma(hueOf(h, c), clamp(Math.max(0.028, c * 2), 0, 0.3), 0.078 + t * 0.072, a);
  }

  if (l >= 0.72) {
    return fromChroma(hueOf(h, c), clamp(Math.max(0.03, c * 1.2), 0, 0.26), 0.205, a);
  }

  if (c < TINT_CHROMA) {
    if (l >= 0.4) {
      return fromChroma(NEUTRAL_HUE, 0.05, 0.3, a);
    }

    // Already a dark surface in light mode - an inverted panel, a dark hero.
    // Lifted a little so it still separates from the page behind it.
    return fromChroma(hueOf(h, c), Math.max(c, 0.035), clamp(l + 0.08, 0.16, 0.32), a);
  }

  // Saturated fills carry meaning: a brand button, a destructive action, a
  // status pill. They survive intact, and only colours too dark to read as a
  // fill against a dark page are lifted.
  return fromChroma(h, c, Math.max(l, 0.42), a);
}

/** Text, icons and every other foreground mark. */
function mapInk(h, c, l, a) {
  if (l > 0.9 && c < SIGNAL_CHROMA) {
    // A near-white foreground is already sitting on a coloured fill; inverting
    // it would put white text on a white button.
    return fromChroma(h, c, l, a);
  }

  if (c >= SIGNAL_CHROMA) {
    // Brand and status text. Lightened enough to clear AA on a dark surface
    // while keeping the hue that made it mean something.
    return fromChroma(h, Math.min(c * 0.75, 0.36), l <= 0.68 ? 0.75 : l, a);
  }

  // Six steps rather than an inversion, because the light palette leans on a
  // long tail of near-identical greys for its hierarchy: primary, secondary,
  // muted and subtle text have to stay four distinguishable weights afterwards.
  const target =
    l <= 0.28
      ? 0.93
      : l <= 0.42
        ? 0.85
        : l <= 0.55
          ? 0.78
          : l <= 0.7
            ? 0.68
            : l <= 0.85
              ? 0.58
              : 0.52;

  return fromChroma(hueOf(h, c), clamp(c * 0.6, 0.015, 0.2), target, a);
}

/** Borders, rings, dividers and outlines. */
function mapLine(h, c, l, a) {
  if (l >= 0.86) {
    return fromChroma(hueOf(h, c), clamp(Math.max(0.03, c * 1.4), 0, 0.18), 0.235, a);
  }

  if (l >= 0.6) {
    return fromChroma(hueOf(h, c), clamp(Math.max(0.035, c * 1.1), 0, 0.2), 0.3, a);
  }

  if (c < TINT_CHROMA) {
    return fromChroma(NEUTRAL_HUE, 0.05, l >= 0.3 ? 0.36 : 0.42, a);
  }

  return fromChroma(h, Math.min(c, 0.5), clamp(l, 0.4, 0.6), a);
}

/**
 * Shadows. A light-mode shadow is a dark translucent smudge and works unchanged;
 * a *light* one is a rim highlight that would glow on a dark page, so it is
 * turned back into a shadow.
 */
function mapShadow(h, c, l, a) {
  if (l > 0.6) {
    return fromChroma(NEUTRAL_HUE, 0.03, 0.06, a === 1 ? 0.55 : a);
  }

  return fromChroma(h, Math.min(c, 0.1), Math.min(l, 0.08), a);
}

/**
 * Brand and merchant colours. These are the one thing dark mode must not
 * reinterpret - a shop's primary colour is the shop's, not the theme's - so the
 * hue and the chroma are carried over untouched and only a colour too dark to
 * be seen against a dark page is lifted far enough to be seen.
 */
function mapAccent(h, c, l, a) {
  if (l >= 0.5) {
    return fromChroma(h, c, l, a);
  }

  return fromChroma(h, c, Math.min(0.62, l + 0.16), a);
}
