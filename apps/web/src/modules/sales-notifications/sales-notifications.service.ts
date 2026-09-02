import { hasPlanFeature } from "../billing/subscription-limits";
import { publicProductWhere } from "../storefront/resolver";
import { redactBuyerName, resolveLocation } from "./sales-notifications.redact";
import {
  countSalesNotificationCandidates,
  getSalesNotificationSettingRecord,
  listSalesNotificationCandidates,
  upsertSalesNotificationSettingRecord,
  type SalesNotificationSettingRecord
} from "./sales-notifications.repository";
import {
  SALES_NOTIFICATION_DEFAULTS,
  SALES_NOTIFICATION_NAME_DISPLAYS,
  SALES_NOTIFICATION_ORDER_STATUSES,
  SALES_NOTIFICATION_POSITIONS,
  salesNotificationSettingsSchema,
  type SalesNotificationEvent,
  type SalesNotificationNameDisplay,
  type SalesNotificationOrderStatus,
  type SalesNotificationPosition,
  type SalesNotificationSettings,
  type SalesNotificationSettingsInput
} from "./sales-notifications.schema";

/**
 * Sales Notifications: settings, entitlement, and the redaction that turns an
 * order row into a sentence a stranger is allowed to read.
 *
 * The redaction is the reason this file exists rather than the component doing
 * it. An `Order` carries a full name, a phone number, an email and a street
 * address, and the card needs two words of that. Deciding here means the browser
 * is never sent the rest — a customer's phone number cannot leak through a
 * storefront widget by way of a prop nobody looked at.
 *
 * The plan key is `sales_notifications`, and it is checked in the *action* that
 * switches the widget on. `getSalesNotificationCapability` below is the display
 * half; it is also read by the storefront dock, because a shop whose plan has
 * lapsed must stop showing the widget rather than keep the last state it saved.
 */

/** The store's standing with this feature, as both surfaces need to state it. */
export type SalesNotificationCapability = {
  /** Orders in the lookback window that could produce a card today. */
  eligibleOrders: number;
  /** The seller's switch. */
  enabled: boolean;
  /** The plan. */
  entitled: boolean;
  /** Both of the above, which is the only thing that puts a card on a page. */
  live: boolean;
};

export async function getSalesNotificationSettings(
  storeId: string
): Promise<SalesNotificationSettings> {
  const record = await getSalesNotificationSettingRecord(storeId);

  return record ? fromRecord(record) : { ...SALES_NOTIFICATION_DEFAULTS };
}

export async function saveSalesNotificationSettings(
  storeId: string,
  input: SalesNotificationSettingsInput
): Promise<SalesNotificationSettings> {
  const parsed = salesNotificationSettingsSchema.parse(input);

  await upsertSalesNotificationSettingRecord(storeId, {
    ...parsed,
    // The column is TEXT; the setting is a list. Joined in the one place that
    // knows both shapes, so neither the repository nor the form has to.
    orderStatuses: parsed.orderStatuses.join(",")
  });

  return parsed;
}

export async function getSalesNotificationCapability(
  storeId: string,
  known?: SalesNotificationSettings
): Promise<SalesNotificationCapability> {
  const settings = known ?? (await getSalesNotificationSettings(storeId));
  const [entitled, eligibleOrders] = await Promise.all([
    hasPlanFeature(storeId, "sales_notifications"),
    countSalesNotificationCandidates({
      orderStatuses: settings.orderStatuses,
      requirePublicProduct: settings.requirePublicProduct,
      since: lookbackStart(settings.lookbackDays),
      storeId
    })
  ]);

  return {
    eligibleOrders,
    enabled: settings.enabled,
    entitled,
    live: settings.enabled && entitled
  };
}

/**
 * The cards this shop would show right now.
 *
 * One per order — a shopper does not need to be told three times that one
 * person bought three things — newest first, and never more than the seller's
 * own session cap, because sending more than the widget can display is only a
 * way to put extra customer data in the page source.
 *
 * Called from the storefront layout, so it runs on every page of a shop that has
 * the widget on. That is one indexed query with a `take`, which is the same
 * order of cost as the wishlist read already sitting beside it.
 */
export async function getSalesNotificationFeed(input: {
  basePath: string;
  settings: SalesNotificationSettings;
  storeId: string;
}): Promise<SalesNotificationEvent[]> {
  const rows = await listSalesNotificationCandidates({
    limit: input.settings.maxPerSession,
    orderStatuses: input.settings.orderStatuses,
    requirePublicProduct: input.settings.requirePublicProduct,
    since: lookbackStart(input.settings.lookbackDays),
    storeId: input.storeId
  });

  // The one definition of "a shopper may see this product", read as a predicate
  // rather than as a `where`. Derived from `publicProductWhere` itself so the
  // two cannot drift: the query narrows by it when the seller asked for that,
  // and this decides what a card may say when they did not.
  const publicProduct = publicProductWhere(input.storeId);
  const events: SalesNotificationEvent[] = [];
  const seenOrders = new Set<string>();

  for (const row of rows) {
    if (events.length >= input.settings.maxPerSession) {
      break;
    }

    if (seenOrders.has(row.order.id)) {
      continue;
    }

    seenOrders.add(row.order.id);

    const product = row.product;
    const isPublic =
      product?.status === publicProduct.status && product.visibility === publicProduct.visibility;

    // A product a shopper can still open is **re-read**: `title` and `imageUrl`
    // on `OrderItem` are a snapshot of the moment of sale, so a renamed or
    // re-photographed product would otherwise advertise itself under an old name
    // and send the shopper to a page that says something else.
    //
    // One that has been hidden, drafted or deleted keeps that snapshot and gets
    // **no link**. The purchase still happened — that is what the card claims —
    // but there is nowhere honest to send anyone, and re-reading a hidden
    // product's current title would publish something the seller unpublished.
    const image = input.settings.showProductImage
      ? ((isPublic ? product.images[0]?.url : null) ?? row.imageUrl ?? null)
      : null;

    events.push({
      buyer: redactBuyerName(row.order.customerName, input.settings.nameDisplay),
      href: isPublic ? `${input.basePath}/products/${product.slug}` : null,
      id: row.order.id,
      imageUrl: image,
      location: input.settings.showLocation
        ? resolveLocation(row.order.shippingCity, row.order.shippingDistrict)
        : null,
      productTitle: isPublic ? product.title : row.title,
      purchasedAt: row.order.createdAt.toISOString()
    });
  }

  return events;
}

/**
 * The most recent real order, unredacted, for the dashboard's live preview.
 *
 * Deliberately *not* the storefront shape: the seller is shown their own
 * customer's actual name and town, and the preview applies the redaction in the
 * browser as they change the setting — which is the only way a privacy control
 * can be understood before it is published rather than after. This is data the
 * seller can already read on the orders page; nothing here reaches a shopper.
 *
 * A fixed 90-day window rather than the seller's own: a shop that has just
 * narrowed the window to three days still deserves to see what the card looks
 * like, and the panel says separately how many orders actually qualify.
 */
export async function getSalesNotificationPreviewSample(storeId: string) {
  const rows = await listSalesNotificationCandidates({
    limit: 1,
    // Every status and no product requirement, whatever the seller has chosen:
    // this is the card's *appearance*, and a shop whose only orders are pending
    // still has to be able to see what its own notification looks like before
    // deciding to publish one.
    orderStatuses: [...SALES_NOTIFICATION_ORDER_STATUSES],
    requirePublicProduct: false,
    since: lookbackStart(90),
    storeId
  });
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    city: row.order.shippingCity,
    customerName: row.order.customerName,
    district: row.order.shippingDistrict,
    imageUrl: row.product?.images[0]?.url ?? row.imageUrl ?? null,
    productTitle: row.product?.title ?? row.title,
    purchasedAt: row.order.createdAt.toISOString()
  };
}

/** The oldest an order may be and still be worth announcing. */
function lookbackStart(lookbackDays: number) {
  const days = Number.isFinite(lookbackDays) ? Math.max(1, Math.min(90, lookbackDays)) : 14;

  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * A stored row, narrowed back to the union types.
 *
 * `nameDisplay` and `position` are TEXT in the database — the runtime DDL has to
 * be idempotent and `CREATE TYPE` is not, the same reason `ProductTaxonomy.type`
 * is text — so a value written by a newer deploy, or by hand, is replaced with
 * the default here rather than reaching a component that switches on it.
 */
function fromRecord(record: SalesNotificationSettingRecord): SalesNotificationSettings {
  return {
    displaySeconds: clamp(record.displaySeconds, 3, 30, SALES_NOTIFICATION_DEFAULTS.displaySeconds),
    enabled: record.enabled,
    gapSeconds: clamp(record.gapSeconds, 5, 300, SALES_NOTIFICATION_DEFAULTS.gapSeconds),
    initialDelaySeconds: clamp(
      record.initialDelaySeconds,
      0,
      120,
      SALES_NOTIFICATION_DEFAULTS.initialDelaySeconds
    ),
    lookbackDays: clamp(record.lookbackDays, 1, 90, SALES_NOTIFICATION_DEFAULTS.lookbackDays),
    loopFeed: record.loopFeed,
    maxPerSession: clamp(record.maxPerSession, 1, 30, SALES_NOTIFICATION_DEFAULTS.maxPerSession),
    nameDisplay: isNameDisplay(record.nameDisplay)
      ? record.nameDisplay
      : SALES_NOTIFICATION_DEFAULTS.nameDisplay,
    orderStatuses: parseOrderStatuses(record.orderStatuses),
    position: isPosition(record.position) ? record.position : SALES_NOTIFICATION_DEFAULTS.position,
    requirePublicProduct: record.requirePublicProduct,
    showLocation: record.showLocation,
    showOnMobile: record.showOnMobile,
    showProductImage: record.showProductImage,
    showTimeAgo: record.showTimeAgo
  };
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * The stored comma-separated status list, back to a checked union.
 *
 * An empty or unreadable column falls back to **every** status rather than to
 * none. Reading a broken row as "show nothing" would switch a seller's widget
 * off without telling them; reading it as "show everything" is the state the
 * dashboard already presents as the default, and one they can see and change.
 */
function parseOrderStatuses(value: string): SalesNotificationOrderStatus[] {
  const parsed = String(value ?? "")
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(isOrderStatus);

  return parsed.length > 0 ? [...new Set(parsed)] : [...SALES_NOTIFICATION_DEFAULTS.orderStatuses];
}

function isOrderStatus(value: string): value is SalesNotificationOrderStatus {
  return (SALES_NOTIFICATION_ORDER_STATUSES as readonly string[]).includes(value);
}

function isNameDisplay(value: string): value is SalesNotificationNameDisplay {
  return (SALES_NOTIFICATION_NAME_DISPLAYS as readonly string[]).includes(value);
}

function isPosition(value: string): value is SalesNotificationPosition {
  return (SALES_NOTIFICATION_POSITIONS as readonly string[]).includes(value);
}
