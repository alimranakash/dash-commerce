import { cache } from "react";
import { hasPlanFeature } from "../billing/subscription-limits";
import { storefrontBasePath } from "../storefront/base-path";
import {
  getNotificationBarRecord,
  upsertNotificationBarRecord,
  type NotificationBarRecord
} from "./notification-bar.repository";
import {
  barWindowState,
  buildNotificationBarView,
  type NotificationBarWindowState
} from "./notification-bar.render";
import {
  NOTIFICATION_BAR_DEFAULTS,
  NOTIFICATION_BAR_DISPLAYS,
  NOTIFICATION_BAR_HOME_SLOTS,
  NOTIFICATION_BAR_LAYOUTS,
  NOTIFICATION_BAR_POSITIONS,
  NOTIFICATION_BAR_PRODUCT_SLOTS,
  NOTIFICATION_BAR_SHOP_SLOTS,
  NOTIFICATION_BAR_SURFACES,
  notificationBarSettingsSchema,
  type NotificationBarSettings,
  type NotificationBarSettingsInput,
  type NotificationBarSurface,
  type NotificationBarView
} from "./notification-bar.schema";

/**
 * The Floating Notification Bar: settings and entitlement.
 *
 * What a shopper is actually shown is decided by `buildNotificationBarView` in
 * `notification-bar.render.ts` rather than here, and deliberately so: it is a
 * pure function of a settings row, a base path and a clock, which is what lets
 * `npm run verify:notification-bar` drive every one of its refusals — a bar
 * whose schedule has not opened, a link this module will not publish, a
 * headline that is empty — without a database.
 *
 * The plan key is `notification_bar`, checked in the *action* that switches the
 * bar on and again in the dock on every render — a store whose plan lapses stops
 * publishing rather than keeping the last `true` it saved.
 */

/** The store's standing with this feature, as both surfaces need to state it. */
export type NotificationBarCapability = {
  /** The seller's switch. */
  enabled: boolean;
  /** The plan. */
  entitled: boolean;
  /** All of the above plus a schedule that is open and a headline to show. */
  live: boolean;
  /** Where the bar is in its own schedule, so the console can say "starts Friday". */
  windowState: NotificationBarWindowState;
};

export async function getNotificationBarSettings(
  storeId: string
): Promise<NotificationBarSettings> {
  const record = await getNotificationBarRecord(storeId);

  return record ? fromRecord(record) : { ...NOTIFICATION_BAR_DEFAULTS };
}

export async function saveNotificationBarSettings(
  storeId: string,
  input: NotificationBarSettingsInput
): Promise<NotificationBarSettings> {
  const parsed = notificationBarSettingsSchema.parse(input);

  await upsertNotificationBarRecord(storeId, {
    ...parsed,
    // The column is TEXT; the setting is a list. Joined in the one place that
    // knows both shapes, so neither the repository nor the form has to.
    surfaces: parsed.surfaces.join(","),
    // The columns are timestamps; the setting is an ISO string. Converted in the
    // one place that knows both shapes, so neither the repository nor the form
    // has to.
    endsAt: parsed.endsAt === null ? null : new Date(parsed.endsAt),
    startsAt: parsed.startsAt === null ? null : new Date(parsed.startsAt)
  });

  return parsed;
}

export async function getNotificationBarCapability(
  storeId: string,
  known?: NotificationBarSettings
): Promise<NotificationBarCapability> {
  const settings = known ?? (await getNotificationBarSettings(storeId));
  const entitled = await hasPlanFeature(storeId, "notification_bar");
  const windowState = barWindowState(settings, Date.now());

  return {
    enabled: settings.enabled,
    entitled,
    live: settings.enabled && entitled && windowState === "open" && settings.headline !== "",
    windowState
  };
}

/**
 * The bar this shop is publishing right now, resolved once per request.
 *
 * `cache()` is the whole point. The home page carries four anchors, the shop
 * listing four, the product page four; every one of them has to ask whether the
 * bar belongs there, and without request memoisation a page with four slots
 * would run four settings queries and four plan lookups to render at most one
 * bar. With it, the first slot pays and the rest are free — the same reason
 * `getStorefrontBySlug` is wrapped in `resolver.ts`.
 *
 * It is also the one place the two gates live, so the dock and the slots cannot
 * drift: the seller's switch, then the plan — re-read on every render rather
 * than trusted from the stored `true`, so a lapsed store stops publishing — then
 * the schedule and the headline, inside `buildNotificationBarView`.
 */
export const resolveNotificationBar = cache(async function resolveNotificationBar(store: {
  id: string;
  slug: string;
}): Promise<NotificationBarView | null> {
  const settings = await getNotificationBarSettings(store.id);

  if (!settings.enabled) {
    return null;
  }

  if (!(await hasPlanFeature(store.id, "notification_bar"))) {
    return null;
  }

  const basePath = await storefrontBasePath(store.slug);

  return buildNotificationBarView({ basePath, settings });
});

/**
 * A stored row, narrowed back to the union types.
 *
 * `position` and `layout` are TEXT in the database — the runtime DDL has to be
 * idempotent and `CREATE TYPE` is not, the same reason `ProductTaxonomy.type` is
 * text — so a value written by a newer deploy, or by hand, is replaced with the
 * default here rather than reaching a component that switches on it.
 */
function fromRecord(record: NotificationBarRecord): NotificationBarSettings {
  return {
    backgroundColor: hexOrEmpty(record.backgroundColor),
    buttonColor: hexOrEmpty(record.buttonColor),
    buttonTextColor: hexOrEmpty(record.buttonTextColor),
    ctaHref: String(record.ctaHref ?? ""),
    ctaLabel: String(record.ctaLabel ?? ""),
    dismissDays: clamp(record.dismissDays, 0, 90, NOTIFICATION_BAR_DEFAULTS.dismissDays),
    dismissible: record.dismissible,
    display: oneOf(record.display, NOTIFICATION_BAR_DISPLAYS, NOTIFICATION_BAR_DEFAULTS.display),
    enabled: record.enabled,
    endsAt: toIso(record.endsAt),
    gridAfter: clamp(record.gridAfter, 1, 24, NOTIFICATION_BAR_DEFAULTS.gridAfter),
    headline: String(record.headline ?? ""),
    homeSlot: oneOf(
      record.homeSlot,
      NOTIFICATION_BAR_HOME_SLOTS,
      NOTIFICATION_BAR_DEFAULTS.homeSlot
    ),
    layout: oneOf(record.layout, NOTIFICATION_BAR_LAYOUTS, NOTIFICATION_BAR_DEFAULTS.layout),
    message: String(record.message ?? ""),
    position: oneOf(
      record.position,
      NOTIFICATION_BAR_POSITIONS,
      NOTIFICATION_BAR_DEFAULTS.position
    ),
    productSlot: oneOf(
      record.productSlot,
      NOTIFICATION_BAR_PRODUCT_SLOTS,
      NOTIFICATION_BAR_DEFAULTS.productSlot
    ),
    shopSlot: oneOf(
      record.shopSlot,
      NOTIFICATION_BAR_SHOP_SLOTS,
      NOTIFICATION_BAR_DEFAULTS.shopSlot
    ),
    showCountdown: record.showCountdown,
    showOnMobile: record.showOnMobile,
    startsAt: toIso(record.startsAt),
    surfaces: parseSurfaces(record.surfaces),
    textColor: hexOrEmpty(record.textColor)
  };
}

/**
 * A TEXT column narrowed back to its union, or the default.
 *
 * One helper rather than six `isPosition`-shaped predicates: they all asked the
 * same question of a different `as const` list, and six copies of it is six
 * places for a new member to be forgotten.
 */
function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * The stored comma-separated surface list, back to a checked union.
 *
 * An empty or unreadable column falls back to **every** surface rather than to
 * none, for the reason `parseOrderStatuses` gives in Sales Notifications:
 * reading a broken row as "show nowhere" would switch a seller's bar off without
 * telling them, while "everywhere" is the state the dashboard already presents
 * as the default and one they can see and change.
 */
function parseSurfaces(value: string): NotificationBarSurface[] {
  const parsed = String(value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is NotificationBarSurface =>
      (NOTIFICATION_BAR_SURFACES as readonly string[]).includes(entry)
    );

  return parsed.length > 0 ? [...new Set(parsed)] : [...NOTIFICATION_BAR_DEFAULTS.surfaces];
}

/**
 * A stored colour, or empty.
 *
 * Anything that is not a hex literal becomes empty rather than being passed
 * through, because these values are written into an inline `style` attribute:
 * empty means "the shop's own colour", which is a safe answer to a column
 * somebody edited by hand.
 */
function hexOrEmpty(value: string | null | undefined) {
  const colour = String(value ?? "").trim();

  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(colour) ? colour : "";
}

function toIso(value: Date | null) {
  if (!value) {
    return null;
  }

  const time = value.getTime();

  return Number.isFinite(time) ? value.toISOString() : null;
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}
