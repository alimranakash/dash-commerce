"use server";

import { revalidatePath } from "next/cache";
import { PlanFeatureError, requirePlanFeature } from "../billing/subscription-limits";
import type { PlanFeatureKey } from "../billing/plan-features";
import { StoreAccessError, requireStoreManager } from "../stores/queries";
import { sendGa4TestEvent } from "./ga4-mp";
import {
  MarketingSettingsError,
  getMarketingSettingsView,
  updateMarketingSettings
} from "./marketing.service";
import type { MarketingSettingsFormInput } from "./marketing.schema";
import {
  TRACKING_SECTIONS,
  trackingInputFromView,
  type TrackingSectionKey
} from "./tracking-sections";
import { sendMetaTestEvent } from "./meta-capi";

export type MarketingActionState = {
  fieldErrors?: Record<string, string>;
  /** Set when the save was refused by the plan, so the UI can open an upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  message?: string;
  status: "error" | "idle" | "success";
};

/**
 * Saves one Analytics & Tracking page.
 *
 * Rebuilds the whole settings object from what is stored, overlays only the
 * fields this section owns, and writes that. The merge is what keeps the split
 * pages honest — and it also means the cross-field rules in the schema (the
 * Conversions API needing a pixel ID, server-side GA4 needing a measurement ID)
 * still see the full picture even though the form only posted part of it.
 *
 * One consequence worth knowing: a stored value that no longer validates — a
 * row edited straight in the database, or an ID format we later tightened —
 * will fail the save of an unrelated section, naming the offending field. That
 * is noisy but honest; the alternative is writing around a value we know is bad.
 */
export async function updateTrackingSectionAction(
  section: TrackingSectionKey,
  _state: MarketingActionState,
  formData: FormData
): Promise<MarketingActionState> {
  let storeSlug: string;

  try {
    const access = await requireStoreManager();

    storeSlug = access.store.slug;

    await requirePlanFeature(access.store.id, "marketing_analytics");

    const stored = await getMarketingSettingsView(access.store.id);
    const input = trackingInputFromView(stored);

    for (const field of TRACKING_SECTIONS[section].fields) {
      applyTrackingField(input, field, formData);
    }

    await updateMarketingSettings({
      input,
      storeId: access.store.id,
      ...(access.organizationId ? { organizationId: access.organizationId } : {}),
      ...(access.userId ? { userId: access.userId } : {})
    });
  } catch (error) {
    return trackingErrorState(error);
  }

  revalidatePath("/dashboard/analytics", "layout");
  revalidatePath(`/s/${storeSlug}`);

  return { message: `${TRACKING_SECTIONS[section].label} saved.`, status: "success" };
}

/** Booleans come off a checkbox, everything else is text. */
function applyTrackingField(
  input: MarketingSettingsFormInput,
  field: keyof MarketingSettingsFormInput,
  formData: FormData
) {
  if (
    field === "customEnabled" ||
    field === "ga4MpEnabled" ||
    field === "metaCapiEnabled" ||
    field === "ga4ApiSecretCleared" ||
    field === "metaCapiTokenCleared"
  ) {
    input[field] = checkbox(formData, field);
    return;
  }

  input[field] = text(formData, field);
}

function trackingErrorState(error: unknown): MarketingActionState {
  if (error instanceof StoreAccessError) {
    return { message: error.message, status: "error" };
  }

  if (error instanceof PlanFeatureError) {
    return { lockedFeature: error.featureKey, message: error.message, status: "error" };
  }

  if (error instanceof MarketingSettingsError) {
    return { fieldErrors: error.fieldErrors, message: error.message, status: "error" };
  }

  return {
    message: error instanceof Error ? error.message : "Could not save these settings.",
    status: "error"
  };
}

export type MarketingTestEventState = {
  message: string;
  ok: boolean;
};

/**
 * Sends a real TestEvent to Meta using the *stored* token, so a seller can prove
 * the credentials work before any customer places an order. Behind the same role
 * gate as saving, since it spends the store's credentials.
 */
export async function sendMetaTestEventAction(): Promise<MarketingTestEventState> {
  try {
    const access = await requireStoreManager();

    await requirePlanFeature(access.store.id, "server_side_tracking");

    const result = await sendMetaTestEvent({
      storeId: access.store.id,
      ...(access.userId ? { userId: access.userId } : {})
    });

    if (result.ok) {
      return {
        message: "Meta accepted the test event. Check Events Manager → Test events.",
        ok: true
      };
    }

    return {
      message:
        result.reason === "disabled"
          ? "Turn the Conversions API on and save before sending a test event."
          : result.reason === "not-configured"
            ? `${result.message} Save your pixel ID and token first.`
            : result.message,
      ok: false
    };
  } catch (error) {
    if (error instanceof StoreAccessError || error instanceof PlanFeatureError) {
      return { message: error.message, ok: false };
    }

    return { message: "Could not send the test event.", ok: false };
  }
}

/**
 * The GA4 counterpart. Validates against Google's debug endpoint and then sends
 * a real event, so a success here means the credentials work and the seller can
 * go and look for it. Behind the same role gate, since it spends store secrets.
 */
export async function sendGa4TestEventAction(): Promise<MarketingTestEventState> {
  try {
    const access = await requireStoreManager();

    await requirePlanFeature(access.store.id, "server_side_tracking");

    const result = await sendGa4TestEvent({
      storeId: access.store.id,
      ...(access.userId ? { userId: access.userId } : {})
    });

    if (result.ok) {
      return {
        message: "Google accepted the test event. Check GA4 → Reports → Realtime.",
        ok: true
      };
    }

    return {
      message:
        result.reason === "disabled"
          ? "Turn server-side tracking on and save before sending a test event."
          : result.reason === "not-configured"
            ? `${result.message} Save your Measurement ID and API secret first.`
            : result.message,
      ok: false
    };
  } catch (error) {
    if (error instanceof StoreAccessError || error instanceof PlanFeatureError) {
      return { message: error.message, ok: false };
    }

    return { message: "Could not send the test event.", ok: false };
  }
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}
