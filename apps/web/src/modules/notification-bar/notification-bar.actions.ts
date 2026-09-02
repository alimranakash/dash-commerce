"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { PlanFeatureKey } from "../billing/plan-features";
import { PlanFeatureError, requirePlanFeature } from "../billing/subscription-limits";
import { requireStoreManager } from "../stores/queries";
import {
  getNotificationBarCapability,
  saveNotificationBarSettings,
  type NotificationBarCapability
} from "./notification-bar.service";
import {
  NOTIFICATION_BAR_DEFAULTS,
  notificationBarSettingsSchema,
  type NotificationBarSettings
} from "./notification-bar.schema";

/**
 * The seller's switch, and the only write in this module.
 *
 * `requireStoreManager()` rather than `requireStore()`: this publishes a line of
 * the shop's own copy to every visitor it has, which is the same class of act as
 * switching on the shopping assistant or a tracking pixel — a MEMBER may read
 * the page, not change it.
 *
 * Switching **on** goes through `requirePlanFeature`, so an unentitled store
 * cannot store a `true` that would go live the moment somebody upgraded. Turning
 * it **off** is deliberately ungated — the same line coupons, bundles, the
 * shopping agent and sales notifications draw: whatever has happened to a
 * seller's billing, they must always be able to take down something that is
 * running on their own storefront.
 */
export type NotificationBarSettingsState = {
  /** Recomputed on the server so the page cannot disagree with what it saved. */
  capability?: NotificationBarCapability;
  /** Set when the plan refused the save, so the page opens the upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  message?: string;
  /** The saved settings, so the form re-renders from the server's word for it. */
  settings?: NotificationBarSettings;
  status: "idle" | "success" | "error";
};

export async function saveNotificationBarAction(
  _state: NotificationBarSettingsState,
  formData: FormData
): Promise<NotificationBarSettingsState> {
  try {
    const { store } = await requireStoreManager();
    const input = notificationBarSettingsSchema.parse({
      backgroundColor: textField(formData, "backgroundColor"),
      buttonColor: textField(formData, "buttonColor"),
      buttonTextColor: textField(formData, "buttonTextColor"),
      ctaHref: textField(formData, "ctaHref"),
      ctaLabel: textField(formData, "ctaLabel"),
      dismissDays: numberField(formData, "dismissDays", "dismissDays"),
      dismissible: checkboxField(formData, "dismissible"),
      display: formData.get("display"),
      enabled: checkboxField(formData, "enabled"),
      endsAt: textField(formData, "endsAt"),
      gridAfter: numberField(formData, "gridAfter", "gridAfter"),
      headline: textField(formData, "headline"),
      homeSlot: formData.get("homeSlot"),
      layout: formData.get("layout"),
      message: textField(formData, "message"),
      position: formData.get("position"),
      productSlot: formData.get("productSlot"),
      shopSlot: formData.get("shopSlot"),
      showCountdown: checkboxField(formData, "showCountdown"),
      showOnMobile: checkboxField(formData, "showOnMobile"),
      startsAt: textField(formData, "startsAt"),
      surfaces: surfaceField(formData),
      textColor: textField(formData, "textColor")
    });

    if (input.enabled) {
      await requirePlanFeature(store.id, "notification_bar");
    }

    const settings = await saveNotificationBarSettings(store.id, input);
    // Read back rather than assumed from `input.enabled`: a bar scheduled for
    // next Friday is saved and switched on and still shows nothing today, and
    // the panel has to be able to say so.
    const capability = await getNotificationBarCapability(store.id, settings);

    revalidatePath("/dashboard/marketing/notification-bar");
    // The storefront layout decides whether to mount the bar and hands it the
    // content, so a save has to take effect on the shop's pages rather than
    // waiting for them to go stale. Internal route on purpose: `/s/<slug>` is
    // what Next serves and the clean address is a rewrite onto it.
    revalidatePath(`/s/${store.slug}`, "layout");

    return {
      capability,
      message: capability.live
        ? "Your notification bar is live on your storefront."
        : capability.enabled
          ? capability.windowState === "scheduled"
            ? "Saved. The bar appears when its start time arrives."
            : capability.windowState === "ended"
              ? "Saved. That end time has passed, so the bar is not showing."
              : "Saved, but the bar is not showing yet."
          : "Your notification bar is switched off.",
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
    return NOTIFICATION_BAR_DEFAULTS[name as keyof NotificationBarSettings] === true;
  }

  return value === "on" || value === "true";
}

/**
 * The chosen pages, posted as one comma-separated field.
 *
 * Left exactly as submitted — unknown values are not filtered out here, so the
 * schema refuses the whole save rather than quietly storing a narrower set than
 * the seller ticked. A field that never arrived falls back to every page, which
 * is also what the schema's `min(1)` would otherwise reject.
 */
function surfaceField(formData: FormData) {
  const value = formData.get("surfaces");

  if (typeof value !== "string" || value.trim() === "") {
    return [...NOTIFICATION_BAR_DEFAULTS.surfaces];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** A text field as submitted. Absent becomes empty, which every string field reads as "unset". */
function textField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function numberField(formData: FormData, name: string, fallbackKey: keyof NotificationBarSettings) {
  const value = formData.get(name);
  const parsed = Number(value);

  return value === null || value === "" || !Number.isFinite(parsed)
    ? NOTIFICATION_BAR_DEFAULTS[fallbackKey]
    : parsed;
}
