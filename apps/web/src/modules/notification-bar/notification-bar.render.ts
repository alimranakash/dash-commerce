/**
 * Everything the Floating Notification Bar computes, in the one place both
 * surfaces compute it.
 *
 * Its own module with no database import, for the reason
 * `sales-notifications.redact.ts` is: the storefront bar runs these in the
 * browser and the dashboard's live preview runs the *same* functions as the
 * seller types, so what the console shows and what a shopper sees cannot be two
 * implementations that drift. It is also what `npm run verify:notification-bar`
 * exercises, since every function here is pure.
 *
 * Three things live here, and each one is a rule rather than a formatter:
 *
 * - **The countdown counts to a real moment.** There is no evergreen timer here
 *   — no "restart for every visitor", no "always show 4 hours left". A countdown
 *   that resets per shopper is the most common thing these widgets do and the
 *   most dishonest: it states a deadline that does not exist, to make someone
 *   buy today. `countdownParts` takes one absolute timestamp, so every shopper
 *   in the world is told the same number of seconds, and when it reaches zero it
 *   stays at zero.
 * - **A seller-typed link is still a link on a public page.** `isSafeBarHref` is
 *   an allow-list, not a blocklist: a relative path, an in-page anchor, a phone
 *   or mail address, or `http(s)`. `javascript:` cannot be spelled past it, and
 *   neither can the protocol-relative `//evil.example` that a "starts with a
 *   slash" test would have waved through as a path.
 * - **A dismissal is about one bar, not about bars.** `barRevision` fingerprints
 *   what the shopper actually read, so pressing X silences *that* announcement
 *   while the next one — a new sale, a new deadline — is still shown. Filing the
 *   dismissal against the store alone would make a seller's next campaign
 *   invisible to everyone who closed the last one.
 */

import type {
  NotificationBarAnchor,
  NotificationBarSettings,
  NotificationBarSurface,
  NotificationBarView
} from "./notification-bar.schema";

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Milliseconds left, clamped at zero. Zero is what takes the bar down. */
  totalMs: number;
};

/**
 * How long is left, from one absolute deadline.
 *
 * `nowMs` is a parameter rather than a `Date.now()` inside, so the check can
 * drive it and the component can tick it. A deadline that has passed produces
 * all zeros rather than negative digits — the bar removes itself at that point,
 * but a frame rendered on the way there must not read "-1".
 */
export function countdownParts(endsAtMs: number, nowMs: number): CountdownParts {
  if (!Number.isFinite(endsAtMs) || !Number.isFinite(nowMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  }

  const totalMs = Math.max(0, endsAtMs - nowMs);
  const totalSeconds = Math.floor(totalMs / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs
  };
}

/** Two digits, the way a clock is read. Days pass through above 99. */
export function padCountdown(value: number) {
  const safe = Math.max(0, Math.floor(value));

  return safe < 10 ? `0${safe}` : String(safe);
}

/**
 * Where the bar is in its own schedule, decided from timestamps alone.
 *
 * `scheduled` is the state that earns this function: a bar whose start is still
 * in the future must produce **no markup at all**, not markup hidden with CSS.
 * A shopper reading the page source before a sale opens would otherwise have
 * next week's discount, which is a thing sellers plan around.
 */
export type NotificationBarWindowState = "ended" | "open" | "scheduled";

export function barWindowState(
  window: { endsAt: string | null; startsAt: string | null },
  nowMs: number
): NotificationBarWindowState {
  const startsAt = toTimestamp(window.startsAt);
  const endsAt = toTimestamp(window.endsAt);

  if (startsAt !== null && nowMs < startsAt) {
    return "scheduled";
  }

  // `>=` rather than `>`: the deadline itself is the first moment the offer is
  // over, and it is the same instant the countdown reads all zeros. A bar still
  // promising a discount whose timer has run out is this feature's failure mode.
  if (endsAt !== null && nowMs >= endsAt) {
    return "ended";
  }

  return "open";
}

/** An ISO string as epoch milliseconds, or null when it is neither. */
export function toTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Whether a seller-typed destination may be put on a public page.
 *
 * An allow-list of four shapes. Everything else — `javascript:`, `data:`,
 * `vbscript:`, a bare `evil.example`, and the protocol-relative `//evil.example`
 * that reads like a path — is refused, and refused in the *schema*, so an unsafe
 * href cannot be stored rather than merely not rendered.
 */
export function isSafeBarHref(value: string) {
  const href = value.trim();

  if (href === "" || href.length > 500) {
    return false;
  }

  // A control character is how a scheme gets smuggled past a prefix test: a tab
  // or a newline inside "java(tab)script:" is stripped by the browser and not by
  // a naive `startsWith`. Checked by code point rather than with an escape in a
  // character class, so the rule is readable and the source stays plain text.
  for (let index = 0; index < href.length; index += 1) {
    const code = href.charCodeAt(index);

    if (code < 0x20 || code === 0x7f) {
      return false;
    }
  }

  if (href.startsWith("#")) {
    return href.length > 1;
  }

  if (href.startsWith("/")) {
    // `//host` is an absolute URL wearing a path's clothes, and `/\host` is the
    // same trick with the other slash browsers accept.
    return !href.startsWith("//") && !href.startsWith("/\\");
  }

  return /^(https?:\/\/\S|mailto:\S|tel:\S)/i.test(href);
}

export type ResolvedBarLink = {
  href: string;
  /** Only ever true for `http(s)`. A phone number opening a tab is not useful. */
  newTab: boolean;
};

/**
 * The destination as the browser should receive it.
 *
 * Relative paths are prefixed with the storefront's own base path, so a bar
 * pointing at `/products/winter-coat` works on `shop.storeim.com`, on a seller's
 * custom domain, and on `localhost/s/<slug>` — the three addresses the same tree
 * answers on. Returns null for anything `isSafeBarHref` refuses, so the caller
 * renders no button rather than a broken or hostile one.
 */
export function resolveBarLink(basePath: string, value: string): ResolvedBarLink | null {
  const href = value.trim();

  if (!isSafeBarHref(href)) {
    return null;
  }

  if (href.startsWith("#")) {
    return { href, newTab: false };
  }

  if (href.startsWith("/")) {
    return { href: `${basePath}${href}`, newTab: false };
  }

  return { href, newTab: /^https?:/i.test(href) };
}

/**
 * The field separator inside a revision's source string — ASCII Unit Separator,
 * which no seller can type into a headline. Without one, moving a character
 * between two fields would leave the fingerprint unchanged and a genuinely new
 * announcement would stay hidden from everyone who closed the last.
 */
const REVISION_SEPARATOR = String.fromCharCode(31);

/**
 * A short, stable fingerprint of what the shopper actually read.
 *
 * FNV-1a rather than a crypto hash: this runs in the browser as well as on the
 * server, it is not a security boundary, and it has to produce the same eight
 * characters in both. Only the *visible* fields go in — recolouring a bar or
 * moving it to the bottom is not a new announcement, and re-showing it to
 * everyone who closed it would be the widget nagging over a style change.
 */
export function barRevision(content: {
  ctaHref: string;
  ctaLabel: string;
  endsAt: string | null;
  headline: string;
  message: string;
}) {
  const source = [
    content.headline,
    content.message,
    content.ctaLabel,
    content.ctaHref,
    content.endsAt ?? ""
  ].join(REVISION_SEPARATOR);

  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    // The FNV prime as the shifts that survive 32-bit JavaScript arithmetic.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }

  return hash.toString(36).padStart(7, "0").slice(0, 8);
}

/**
 * The bar this shop is showing right now, or null — the whole publishing
 * decision, as one pure function.
 *
 * Four separate things have to be true before a shopper sees anything: the
 * seller switched it on, there is a headline to read, the schedule is open, and
 * — checked by the caller, which needs a database for it — the plan grants the
 * feature. Returning **null** rather than a hidden bar is the point: a sale that
 * opens next Friday must not be readable in this Friday's page source, and a
 * finished one must not be sitting in the DOM with `display: none` for anyone
 * who looks.
 *
 * The link is narrowed by `resolveBarLink` — the seller typed it, and it is
 * about to become an anchor on a public page — and prefixed with the
 * storefront's own base path, so one stored `/products/winter-coat` is right on
 * a subdomain, on a custom domain, and on the `/s/<slug>` path form. A
 * destination this module will not publish produces **no button** rather than a
 * bar with a dead one.
 *
 * The colours are passed through untouched, including empty. Empty is not a
 * missing value to be filled in with a default here: it is the instruction to
 * fall through to the shop's own `--sf-primary` in CSS, which is what keeps a
 * bar matching a storefront the seller re-themes later.
 *
 * `nowMs` is a parameter so the check can drive the schedule without a clock.
 */
export function buildNotificationBarView(input: {
  basePath: string;
  nowMs?: number;
  settings: NotificationBarSettings;
}): NotificationBarView | null {
  const { settings } = input;
  const nowMs = input.nowMs ?? Date.now();

  if (!settings.enabled) {
    return null;
  }

  // A bar with nothing to say is not a bar. The schema refuses to publish one,
  // so this is the second half of that rule rather than its only enforcement.
  if (settings.headline === "") {
    return null;
  }

  if (barWindowState(settings, nowMs) !== "open") {
    return null;
  }

  const link = settings.ctaLabel === "" ? null : resolveBarLink(input.basePath, settings.ctaHref);

  return {
    backgroundColor: settings.backgroundColor,
    buttonColor: settings.buttonColor,
    buttonTextColor: settings.buttonTextColor,
    cta: link ? { href: link.href, label: settings.ctaLabel, newTab: link.newTab } : null,
    dismissDays: settings.dismissDays,
    dismissible: settings.dismissible,
    // The stored deadline, passed straight through. There is nowhere in this
    // function to add a duration to `nowMs`, which is what an evergreen timer
    // would need — a shopper's countdown is the seller's deadline or it is
    // nothing.
    display: settings.display,
    endsAt: settings.endsAt,
    gridAfter: settings.gridAfter,
    headline: settings.headline,
    homeSlot: settings.homeSlot,
    layout: settings.layout,
    message: settings.message,
    position: settings.position,
    productSlot: settings.productSlot,
    revision: barRevision(settings),
    shopSlot: settings.shopSlot,
    showCountdown: settings.showCountdown && settings.endsAt !== null,
    showOnMobile: settings.showOnMobile,
    surfaces: [...settings.surfaces],
    textColor: settings.textColor
  };
}

/**
 * Whether *this* anchor, on *this* page, is where the bar goes.
 *
 * Every placement in the storefront asks this one function — the home page's
 * four slots, the shop listing's four, the product page's four — so there is one
 * definition of "here" rather than a condition written out at each site, half of
 * which would eventually disagree. It is pure, so the check can drive all twelve
 * without rendering a page.
 *
 * Two rules are worth stating because they are decisions, not plumbing:
 *
 * - **An overlay is never inline.** A bar pinned to the viewport is mounted once
 *   from the layout and follows the shopper; it has no anchor to match, so every
 *   slot answers `false` and the layout's dock answers for it instead. Otherwise
 *   a seller switching to `overlay` would get two bars.
 * - **A page the seller did not tick shows nothing**, even at an anchor that
 *   matches. The surface is checked first because it is the coarser answer, and
 *   because "not on this page" is the reason a seller will be looking for.
 */
export function barAppearsAt(
  bar: Pick<NotificationBarView, "display" | "homeSlot" | "productSlot" | "shopSlot" | "surfaces">,
  surface: NotificationBarSurface,
  anchor: NotificationBarAnchor
) {
  if (bar.display !== "inline") {
    return false;
  }

  if (!bar.surfaces.includes(surface)) {
    return false;
  }

  switch (surface) {
    case "home":
      return bar.homeSlot === anchor;
    case "product":
      return bar.productSlot === anchor;
    case "shop":
      return bar.shopSlot === anchor;
    default:
      // Every other storefront page — categories, search, cart, the account
      // pages. There is no slot vocabulary for a page this module knows nothing
      // about, so the bar goes at the top of the content, which is the one place
      // that exists on all of them.
      return anchor === "top";
  }
}
