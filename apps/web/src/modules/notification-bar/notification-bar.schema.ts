import { z } from "zod";
import { barWindowState, isSafeBarHref, toTimestamp } from "./notification-bar.render";

/**
 * The Floating Notification Bar — the shop's one announcement, and the deadline
 * on it.
 *
 * One rule shapes everything below: **the bar's deadline and the bar's life are
 * the same date.** `endsAt` is the moment the countdown reaches zero *and* the
 * moment the bar comes off the storefront, because the alternative — a timer
 * target and a separate schedule — is a shop advertising "ends in 4 days" on a
 * sale that finished on Tuesday, or a countdown sitting at 00:00:00:00 for a
 * week. Sellers do not deliberately publish either; they publish them by
 * filling in two fields on a Monday and forgetting one of them. So there is one
 * field, and it does both jobs.
 *
 * That rule is also why there is no "evergreen" mode. The countdown is computed
 * from one absolute timestamp in `notification-bar.render.ts`, so every shopper
 * sees the same seconds remaining; a per-visitor timer would make the urgency
 * on the bar a thing the shop invented, and there is nowhere in this module to
 * invent one.
 *
 * What the seller does control is what it says, where it sits, what it looks
 * like, and how hard it pushes — the knobs below.
 */

/** Top or bottom of the viewport. Bottom is the default; see the defaults note. */
export const NOTIFICATION_BAR_POSITIONS = ["top", "bottom"] as const;
export type NotificationBarPosition = (typeof NOTIFICATION_BAR_POSITIONS)[number];

/**
 * The two shapes the bar takes.
 *
 * `floating` is the rounded, inset pill this feature is named for — it reads as
 * a card laid over the shop. `edge` is the full-bleed bar flush to the top or
 * bottom, which is what a seller reaches for when the announcement is permanent
 * furniture rather than a campaign.
 */
export const NOTIFICATION_BAR_LAYOUTS = ["floating", "edge"] as const;
export type NotificationBarLayout = (typeof NOTIFICATION_BAR_LAYOUTS)[number];

/**
 * The two ways the bar can be attached to the shop, and the reason page
 * targeting only applies to one of them.
 *
 * `overlay` is pinned to the viewport and mounted once from the storefront
 * layout: it follows the shopper from a category to a product to the cart
 * without replaying its entrance or reopening after an X. That is what a
 * *floating* bar is, and "show it on the home page only" is not a coherent thing
 * to ask of something that follows you — so an overlay is shop-wide, and the
 * console says so rather than offering a control that would quietly do nothing.
 *
 * `inline` is placed in the page's own flow at a chosen anchor. It scrolls with
 * the content, takes real layout space rather than covering anything, and is the
 * mode the surface and slot settings below exist for.
 */
export const NOTIFICATION_BAR_DISPLAYS = ["overlay", "inline"] as const;
export type NotificationBarDisplay = (typeof NOTIFICATION_BAR_DISPLAYS)[number];

/**
 * The storefront pages an inline bar can be placed on.
 *
 * `other` is every remaining storefront page — categories, search, cart,
 * checkout, wishlist, the account pages. One name rather than seven, because a
 * seller reasons about "my three selling pages" and "everywhere else", and a
 * list that grew a checkbox every time a route was added would be a list nobody
 * finished reading.
 */
export const NOTIFICATION_BAR_SURFACES = ["home", "shop", "product", "other"] as const;
export type NotificationBarSurface = (typeof NOTIFICATION_BAR_SURFACES)[number];

/**
 * Where on the home page an inline bar sits.
 *
 * Four anchors that mean the same thing on all four templates, which is the
 * constraint that chose them: every template renders one wrapper with a hero
 * first and its own sections under it, so "under the hero" and "after the first
 * section below the hero" are places each one can point at exactly. Naming a
 * template's own sections — "after Best Sellers" — would have been a setting
 * that silently moved when a seller switched template.
 */
export const NOTIFICATION_BAR_HOME_SLOTS = [
  "top",
  "after_hero",
  "after_first_section",
  "before_footer"
] as const;
export type NotificationBarHomeSlot = (typeof NOTIFICATION_BAR_HOME_SLOTS)[number];

/**
 * Where on the shop listing an inline bar sits.
 *
 * `in_grid` is the one worth having: the bar becomes a cell in the product grid
 * after a set number of cards, so a shopper meets the offer while they are
 * already looking at prices. It spans the full width of the grid rather than
 * standing in for a product, because a card-sized advert in a row of products is
 * how a shopper loses their place.
 */
export const NOTIFICATION_BAR_SHOP_SLOTS = [
  "top",
  "above_grid",
  "in_grid",
  "before_footer"
] as const;
export type NotificationBarShopSlot = (typeof NOTIFICATION_BAR_SHOP_SLOTS)[number];

/**
 * Where on a single product page an inline bar sits.
 *
 * `above_cart` and `below_cart` are inside the buy box, on either side of the
 * add-to-cart button — the two positions that actually convert, and the reason
 * this setting is worth its column. `below_details` is under the whole detail
 * band, above the related rail.
 */
export const NOTIFICATION_BAR_PRODUCT_SLOTS = [
  "top",
  "above_cart",
  "below_cart",
  "below_details"
] as const;
export type NotificationBarProductSlot = (typeof NOTIFICATION_BAR_PRODUCT_SLOTS)[number];

export type NotificationBarSettings = {
  /** Empty means the shop's own primary colour, so a new bar is already on-brand. */
  backgroundColor: string;
  buttonColor: string;
  /** Empty means the bar's background colour — a white button on a blue bar. */
  buttonTextColor: string;
  ctaHref: string;
  ctaLabel: string;
  /** How long an X is honoured for. 0 means this visit only. */
  dismissDays: number;
  dismissible: boolean;
  /** Pinned to the viewport, or placed in the page's own flow. */
  display: NotificationBarDisplay;
  enabled: boolean;
  /** ISO. The countdown target *and* the moment the bar comes down. */
  endsAt: string | null;
  /** How many product cards come before an `in_grid` bar. */
  gridAfter: number;
  /** The big line — "20% OFF". The one field a published bar cannot be without. */
  headline: string;
  homeSlot: NotificationBarHomeSlot;
  layout: NotificationBarLayout;
  /** The supporting line, optional. */
  message: string;
  position: NotificationBarPosition;
  productSlot: NotificationBarProductSlot;
  shopSlot: NotificationBarShopSlot;
  showCountdown: boolean;
  showOnMobile: boolean;
  /** ISO. Before it, the storefront renders nothing at all. */
  startsAt: string | null;
  /** Which pages an inline bar appears on. Never empty — see the schema. */
  surfaces: NotificationBarSurface[];
  textColor: string;
};

/**
 * What a shop gets before anyone touches the form.
 *
 * `enabled: false` is the one that matters, and it is the same line the AI
 * Shopping Agent and Sales Notifications draw: an entitled plan must never
 * publish something on a seller's storefront by itself.
 *
 * `position: "bottom"` rather than top, because the top of a storefront already
 * has the announcement strip, the header and — on the templates that use it —
 * a sticky nav. A floating bar there covers the shop's own name. The bottom is
 * empty apart from two round buttons, which the CSS lifts clear of it.
 *
 * The colours are empty rather than a chosen blue: empty resolves to the shop's
 * own `--sf-primary`, so a seller who switches the bar on and types one line
 * gets something that matches their storefront instead of somebody else's brand.
 */
export const NOTIFICATION_BAR_DEFAULTS: NotificationBarSettings = {
  backgroundColor: "",
  buttonColor: "#ffffff",
  buttonTextColor: "",
  ctaHref: "",
  ctaLabel: "",
  dismissDays: 1,
  dismissible: true,
  display: "overlay",
  enabled: false,
  endsAt: null,
  gridAfter: 4,
  headline: "",
  homeSlot: "after_hero",
  layout: "floating",
  message: "",
  position: "bottom",
  productSlot: "below_cart",
  shopSlot: "above_grid",
  showCountdown: true,
  showOnMobile: true,
  startsAt: null,
  surfaces: [...NOTIFICATION_BAR_SURFACES],
  textColor: "#ffffff"
};

/** `#abc` or `#a1b2c3`, or empty for "use the shop's own colour". */
const hexColor = z
  .string()
  .trim()
  .max(9)
  .refine((value) => value === "" || /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value), {
    message: "Use a hex colour such as #2f6bff, or leave it blank for your shop's colour."
  });

/** An empty string or an ISO timestamp — never a half-parsed date. */
const optionalTimestamp = z
  .string()
  .trim()
  .max(40)
  .refine((value) => value === "" || toTimestamp(value) !== null, {
    message: "That date could not be read."
  })
  // Stored and compared as ISO throughout, so the console's `datetime-local`
  // value — which is the seller's own wall clock and carries no zone — is
  // converted once, in the browser that knows what zone that was.
  .transform((value) => (value === "" ? null : new Date(value).toISOString()))
  .nullable();

/**
 * The bounds are the product decision, not defensive parsing.
 *
 * A headline is capped at 60 characters because the bar is one line on a phone
 * and a paragraph in it is a paragraph nobody reads; the CTA label at 28 for the
 * same reason. `dismissDays` stops at 90 rather than "forever": an announcement
 * a shopper can never see again is one a seller cannot fix by re-publishing it,
 * and 90 days is longer than any campaign this bar is for.
 */
export const notificationBarSettingsSchema = z
  .object({
    backgroundColor: hexColor,
    buttonColor: hexColor,
    buttonTextColor: hexColor,
    ctaHref: z.string().trim().max(500),
    ctaLabel: z.string().trim().max(28),
    dismissDays: z.coerce.number().int().min(0).max(90),
    dismissible: z.boolean(),
    display: z.enum(NOTIFICATION_BAR_DISPLAYS),
    enabled: z.boolean(),
    endsAt: optionalTimestamp,
    // A bar after nothing is a bar at the top of the grid, which `above_grid`
    // already is; 24 is a full page of products on the widest column setting.
    gridAfter: z.coerce.number().int().min(1).max(24),
    headline: z.string().trim().max(60),
    homeSlot: z.enum(NOTIFICATION_BAR_HOME_SLOTS),
    layout: z.enum(NOTIFICATION_BAR_LAYOUTS),
    message: z.string().trim().max(120),
    position: z.enum(NOTIFICATION_BAR_POSITIONS),
    productSlot: z.enum(NOTIFICATION_BAR_PRODUCT_SLOTS),
    shopSlot: z.enum(NOTIFICATION_BAR_SHOP_SLOTS),
    showCountdown: z.boolean(),
    showOnMobile: z.boolean(),
    startsAt: optionalTimestamp,
    // At least one: an inline bar with no page to sit on is a bar that is on and
    // can never appear, which reads as broken rather than as switched off. The
    // same rule Sales Notifications applies to its order statuses.
    surfaces: z
      .array(z.enum(NOTIFICATION_BAR_SURFACES))
      .min(1, "Choose at least one page for the bar to appear on.")
      .transform((values) => [...new Set(values)]),
    textColor: hexColor
  })
  .superRefine((value, ctx) => {
    // Everything below is a rule about *publishing*. A bar that is switched off
    // is a draft, and refusing to save a draft because its end date has passed
    // would leave a seller unable to edit their way out of it.
    if (value.ctaLabel !== "" && !isSafeBarHref(value.ctaHref)) {
      ctx.addIssue({
        code: "custom",
        message:
          "A button needs somewhere to go: a path like /products, an https:// address, or a tel: number.",
        path: ["ctaHref"]
      });
    }

    if (value.ctaHref !== "" && value.ctaLabel === "") {
      ctx.addIssue({
        code: "custom",
        message: "Give the button something to say.",
        path: ["ctaLabel"]
      });
    }

    const startsAt = toTimestamp(value.startsAt);
    const endsAt = toTimestamp(value.endsAt);

    if (startsAt !== null && endsAt !== null && endsAt <= startsAt) {
      ctx.addIssue({
        code: "custom",
        message: "The bar cannot end before it starts.",
        path: ["endsAt"]
      });
    }

    if (!value.enabled) {
      return;
    }

    if (value.headline === "") {
      ctx.addIssue({
        code: "custom",
        message: "Write the line shoppers will read before switching the bar on.",
        path: ["headline"]
      });
    }

    // The rule this whole module is arranged around, enforced at the one moment
    // it can be: publishing a bar whose deadline is already behind it would put
    // a finished sale on the storefront with a timer reading all zeros.
    if (barWindowState(value, Date.now()) === "ended") {
      ctx.addIssue({
        code: "custom",
        message:
          "That end time has already passed. Pick a new one, or clear it to run the bar until you switch it off.",
        path: ["endsAt"]
      });
    }

    if (value.showCountdown && endsAt === null) {
      ctx.addIssue({
        code: "custom",
        message: "A countdown needs an end time — that is the number it counts down to.",
        path: ["endsAt"]
      });
    }
  });

export type NotificationBarSettingsInput = z.infer<typeof notificationBarSettingsSchema>;

/**
 * The bar as the browser receives it.
 *
 * Resolved, not raw: the link has already been narrowed by `isSafeBarHref` and
 * prefixed with the storefront's base path, the colours have already fallen back
 * to the shop's own, and `revision` is already computed. The client's job is to
 * tick a clock and honour an X — every decision that could be got wrong has been
 * made on the server, where the check can reach it.
 */
export type NotificationBarView = {
  backgroundColor: string;
  buttonColor: string;
  buttonTextColor: string;
  /** Null when the seller set no button, or set one this module would not publish. */
  cta: { href: string; label: string; newTab: boolean } | null;
  dismissDays: number;
  dismissible: boolean;
  display: NotificationBarDisplay;
  endsAt: string | null;
  gridAfter: number;
  headline: string;
  homeSlot: NotificationBarHomeSlot;
  layout: NotificationBarLayout;
  message: string;
  position: NotificationBarPosition;
  productSlot: NotificationBarProductSlot;
  /** Fingerprint of the visible content, so an X applies to this announcement. */
  revision: string;
  shopSlot: NotificationBarShopSlot;
  showCountdown: boolean;
  showOnMobile: boolean;
  surfaces: NotificationBarSurface[];
  textColor: string;
};

/**
 * One placement, as a page asks about it.
 *
 * A page or template renders `<NotificationBarSlot surface="product"
 * anchor="below_cart" />` and this is the question that gets answered — which is
 * why `barAppearsAt` in `notification-bar.render.ts` is a pure function of the
 * view: every anchor in the storefront asks it, and none of them may answer for
 * itself.
 */
export type NotificationBarAnchor =
  | NotificationBarHomeSlot
  | NotificationBarProductSlot
  | NotificationBarShopSlot;
