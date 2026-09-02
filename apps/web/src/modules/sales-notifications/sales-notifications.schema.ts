import { z } from "zod";

/**
 * Sales Notifications — the storefront's social-proof toast.
 *
 * One rule decides the shape of everything in this module: **an event is a real
 * order or it does not exist.** There is no "simulated activity" mode, no
 * generator, and no seed list a seller can type names into. A shop with no
 * orders in the window shows nothing, and that is the correct outcome — the
 * whole value of the card is that a shopper can trust the sentence on it, and a
 * fabricated one is a lie told in the seller's name to their own customers.
 *
 * What the seller *does* control is how much of a real order is repeated in
 * public: how the buyer is named, whether the town shows, how often a card
 * appears and for how long. Those are the knobs below.
 */

/**
 * How much of the buyer's name a stranger is shown.
 *
 * `initial` is the default rather than `first_name`, because the card is read by
 * people who did not consent to appear on it. "Rahim A." is enough to make the
 * order read as a person's rather than a statistic, without publishing a
 * customer's full name to every visitor of the shop.
 */
export const SALES_NOTIFICATION_NAME_DISPLAYS = ["first_name", "initial", "anonymous"] as const;
export type SalesNotificationNameDisplay = (typeof SALES_NOTIFICATION_NAME_DISPLAYS)[number];

/** Which corner the card sits in. */
export const SALES_NOTIFICATION_POSITIONS = [
  "bottom-left",
  "bottom-right",
  "top-left",
  "top-right"
] as const;
export type SalesNotificationPosition = (typeof SALES_NOTIFICATION_POSITIONS)[number];

/**
 * The order statuses a card may be drawn from, as the seller chooses them.
 *
 * Mirrors `OrderStatus` in schema.prisma. Kept as its own list rather than
 * imported from the generated client so this file stays free of Prisma — the
 * dashboard's live preview imports it into the browser.
 *
 * All five are offered, cancelled included. A cancelled order is the shop
 * saying that purchase did not happen, so advertising one is a claim the shop
 * itself contradicts — but on a cash-on-delivery market where an order is
 * cancelled for a hundred ordinary reasons, that is the seller's call to make
 * and not this module's. The dashboard says which is which; the default set
 * below is every status, which is what a seller expects "show my orders" to
 * mean.
 */
export const SALES_NOTIFICATION_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED"
] as const;
export type SalesNotificationOrderStatus = (typeof SALES_NOTIFICATION_ORDER_STATUSES)[number];

export type SalesNotificationSettings = {
  displaySeconds: number;
  enabled: boolean;
  gapSeconds: number;
  initialDelaySeconds: number;
  lookbackDays: number;
  loopFeed: boolean;
  maxPerSession: number;
  nameDisplay: SalesNotificationNameDisplay;
  /** Which order statuses qualify. At least one, or nothing could ever show. */
  orderStatuses: SalesNotificationOrderStatus[];
  position: SalesNotificationPosition;
  /**
   * Whether a card is limited to products that are still on sale.
   *
   * Off by default, which is the difference between a widget that works and one
   * that silently shows nothing: a product deleted or hidden since the sale
   * leaves an order line that is still a real purchase, and the card is drawn
   * from that snapshot with no link on it. Switched on, only items a shopper
   * could open and buy today are advertised.
   */
  requirePublicProduct: boolean;
  showLocation: boolean;
  showOnMobile: boolean;
  showProductImage: boolean;
  showTimeAgo: boolean;
};

/**
 * What a shop gets before anyone touches the form.
 *
 * `enabled: false` is the one that matters: an entitled plan must never publish
 * something on a seller's storefront by itself, the same line the AI Shopping
 * Agent draws. The timings are the conservative end of what these widgets ship
 * with — eight seconds before the first card so it never competes with the hero
 * image, and eight cards a session so the shop does not spend a shopper's whole
 * visit talking about other shoppers.
 */
export const SALES_NOTIFICATION_DEFAULTS: SalesNotificationSettings = {
  displaySeconds: 6,
  enabled: false,
  gapSeconds: 18,
  initialDelaySeconds: 8,
  lookbackDays: 14,
  loopFeed: true,
  maxPerSession: 8,
  nameDisplay: "initial",
  orderStatuses: [...SALES_NOTIFICATION_ORDER_STATUSES],
  position: "bottom-left",
  requirePublicProduct: false,
  showLocation: true,
  showOnMobile: true,
  showProductImage: true,
  showTimeAgo: true
};

/**
 * The bounds are the product decision, not defensive parsing.
 *
 * A card that shows for two seconds cannot be read; one that reappears every
 * three seconds is the reason shoppers install blockers. The ceilings are as
 * load-bearing as the floors — `lookbackDays` caps at 90 because "just
 * purchased" over an order from March is the same untruth as inventing one.
 */
export const salesNotificationSettingsSchema = z.object({
  displaySeconds: z.coerce.number().int().min(3).max(30),
  enabled: z.boolean(),
  gapSeconds: z.coerce.number().int().min(5).max(300),
  initialDelaySeconds: z.coerce.number().int().min(0).max(120),
  lookbackDays: z.coerce.number().int().min(1).max(90),
  loopFeed: z.boolean(),
  maxPerSession: z.coerce.number().int().min(1).max(30),
  nameDisplay: z.enum(SALES_NOTIFICATION_NAME_DISPLAYS),
  // At least one: an empty set is a widget that is on and can never show
  // anything, which reads as broken rather than as switched off.
  orderStatuses: z
    .array(z.enum(SALES_NOTIFICATION_ORDER_STATUSES))
    .min(1, "Choose at least one order status.")
    .transform((values) => [...new Set(values)]),
  position: z.enum(SALES_NOTIFICATION_POSITIONS),
  requirePublicProduct: z.boolean(),
  showLocation: z.boolean(),
  showOnMobile: z.boolean(),
  showProductImage: z.boolean(),
  showTimeAgo: z.boolean()
});

export type SalesNotificationSettingsInput = z.infer<typeof salesNotificationSettingsSchema>;

/**
 * One card, as the browser receives it.
 *
 * Everything here is already redacted and already resolved: the buyer line is
 * the string that will be printed, not a name to be trimmed on the client, and
 * there is no order id, no total, no phone number and no address beyond the
 * town. The client cannot un-redact what it was never sent, which is why the
 * decision is made in the service and not in the component.
 *
 * `purchasedAt` is an ISO timestamp rather than a rendered "20 mins ago",
 * because the page may sit open for an hour and a server-rendered relative time
 * would quietly become wrong. The component formats it as it shows each card.
 */
export type SalesNotificationEvent = {
  buyer: string;
  /** The product page, base-path applied. Null when the product is no longer public. */
  href: string | null;
  /** Stable across a re-fetch, so React keys and the seen-set agree. */
  id: string;
  imageUrl: string | null;
  /** "Dhaka" or "Dhaka, Bangladesh" — never a street. Null when unknown or switched off. */
  location: string | null;
  productTitle: string;
  purchasedAt: string;
};
