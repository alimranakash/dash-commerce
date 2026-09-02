"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { PlanFeatureKey } from "../billing/plan-features";
import { PlanFeatureError, requirePlanFeature } from "../billing/subscription-limits";
import { requireStoreManager } from "../stores/queries";
import {
  getSalesNotificationCapability,
  saveSalesNotificationSettings,
  type SalesNotificationCapability
} from "./sales-notifications.service";
import {
  SALES_NOTIFICATION_DEFAULTS,
  salesNotificationSettingsSchema,
  type SalesNotificationSettings
} from "./sales-notifications.schema";

/**
 * The seller's switch, and the only write in this module.
 *
 * `requireStoreManager()` rather than `requireStore()`: this publishes a widget
 * that speaks to every visitor of the shop in the shop's name, which is the
 * same class of act as configuring a tracking pixel or switching on the shopping
 * assistant — a MEMBER may read the page, not change it.
 *
 * Switching **on** goes through `requirePlanFeature`, so an unentitled store
 * cannot store a `true` that would go live the moment somebody upgraded. Turning
 * it **off** is deliberately ungated — the same line coupons, bundles and the
 * shopping agent draw: whatever has happened to a seller's billing, they must
 * always be able to stop something that is running on their own storefront.
 */
export type SalesNotificationSettingsState = {
  /** Recomputed on the server so the page cannot disagree with what it saved. */
  capability?: SalesNotificationCapability;
  /** Set when the plan refused the save, so the page opens the upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  message?: string;
  /** The saved settings, so the form re-renders from the server's word for it. */
  settings?: SalesNotificationSettings;
  status: "idle" | "success" | "error";
};

export async function saveSalesNotificationsAction(
  _state: SalesNotificationSettingsState,
  formData: FormData
): Promise<SalesNotificationSettingsState> {
  try {
    const { store } = await requireStoreManager();
    const input = salesNotificationSettingsSchema.parse({
      displaySeconds: numberField(formData, "displaySeconds", "displaySeconds"),
      enabled: checkboxField(formData, "enabled"),
      gapSeconds: numberField(formData, "gapSeconds", "gapSeconds"),
      initialDelaySeconds: numberField(formData, "initialDelaySeconds", "initialDelaySeconds"),
      lookbackDays: numberField(formData, "lookbackDays", "lookbackDays"),
      loopFeed: checkboxField(formData, "loopFeed"),
      maxPerSession: numberField(formData, "maxPerSession", "maxPerSession"),
      nameDisplay: formData.get("nameDisplay"),
      orderStatuses: statusField(formData),
      position: formData.get("position"),
      requirePublicProduct: checkboxField(formData, "requirePublicProduct"),
      showLocation: checkboxField(formData, "showLocation"),
      showOnMobile: checkboxField(formData, "showOnMobile"),
      showProductImage: checkboxField(formData, "showProductImage"),
      showTimeAgo: checkboxField(formData, "showTimeAgo")
    });

    if (input.enabled) {
      await requirePlanFeature(store.id, "sales_notifications");
    }

    const settings = await saveSalesNotificationSettings(store.id, input);
    // Read back rather than assumed from `input.enabled`: a store switched on
    // whose plan has since lapsed is not live, and a shop with no recent orders
    // will show nothing whatever the switch says. The panel has to be able to
    // say both.
    const capability = await getSalesNotificationCapability(store.id);

    revalidatePath("/dashboard/marketing/sales-notifications");
    // The storefront layout decides whether to mount the widget and hands it the
    // feed, so a save has to take effect on the shop's pages rather than waiting
    // for them to go stale. Internal route on purpose: `/s/<slug>` is what Next
    // serves and the clean address is a rewrite onto it.
    revalidatePath(`/s/${store.slug}`, "layout");

    return {
      capability,
      message: capability.live
        ? capability.eligibleOrders > 0
          ? "Sales notifications are live on your storefront."
          : "Saved. Nothing will show yet — there are no orders in the window you chose."
        : "Sales notifications are switched off.",
      settings,
      status: "success"
    };
  } catch (error) {
    if (error instanceof PlanFeatureError) {
      return { lockedFeature: error.featureKey, message: error.message, status: "error" };
    }

    if (error instanceof ZodError) {
      return {
        message: error.issues[0]?.message ?? "Those settings could not be saved.",
        status: "error"
      };
    }

    return {
      message: error instanceof Error ? error.message : "Those settings could not be saved.",
      status: "error"
    };
  }
}

/**
 * The console posts every switch as an explicit `on`/`off` hidden field, so
 * "absent" is a malformed submission rather than "unchecked" — which is what
 * lets the defaults stand in without silently switching something off.
 */
function checkboxField(formData: FormData, name: string) {
  const value = formData.get(name);

  if (value === null) {
    return SALES_NOTIFICATION_DEFAULTS[name as keyof SalesNotificationSettings] === true;
  }

  return value === "on" || value === "true";
}

/**
 * The chosen order statuses, posted as one comma-separated field.
 *
 * Left exactly as submitted — unknown values are not filtered out here, so the
 * schema refuses the whole save rather than quietly saving a narrower set than
 * the seller ticked. A field that never arrived falls back to the default (every
 * status), which is also what the schema's `min(1)` would otherwise reject.
 */
function statusField(formData: FormData) {
  const value = formData.get("orderStatuses");

  if (typeof value !== "string" || value.trim() === "") {
    return [...SALES_NOTIFICATION_DEFAULTS.orderStatuses];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function numberField(
  formData: FormData,
  name: string,
  fallbackKey: keyof SalesNotificationSettings
) {
  const value = formData.get(name);
  const parsed = Number(value);

  return value === null || value === "" || !Number.isFinite(parsed)
    ? SALES_NOTIFICATION_DEFAULTS[fallbackKey]
    : parsed;
}
