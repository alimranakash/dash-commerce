"use server";

import { revalidatePath } from "next/cache";
import { PlanFeatureError, requirePlanFeature } from "../billing/subscription-limits";
import type { PlanFeatureKey } from "../billing/plan-features";
import { StoreAccessError, requireStoreManager } from "../stores/queries";
import { sendGa4TestEvent } from "./ga4-mp";
import { MarketingSettingsError, updateMarketingSettings } from "./marketing.service";
import { sendMetaTestEvent } from "./meta-capi";

export type MarketingActionState = {
  fieldErrors?: Record<string, string>;
  /** Set when the save was refused by the plan, so the UI can open an upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  message?: string;
  status: "error" | "idle" | "success";
};

export async function updateMarketingSettingsFormAction(
  _state: MarketingActionState,
  formData: FormData
): Promise<MarketingActionState> {
  let storeSlug: string;

  try {
    // Re-checked here on purpose: the page renders a read-only form for members,
    // but a disabled input is not a permission check.
    const access = await requireStoreManager();

    storeSlug = access.store.slug;

    // Free plans can open the settings page and read it; saving tracking
    // configuration is the paid part.
    await requirePlanFeature(access.store.id, "marketing_analytics");
    await updateMarketingSettings({
      input: {
        customBodyCode: text(formData, "customBodyCode"),
        customEnabled: checkbox(formData, "customEnabled"),
        customFooterCode: text(formData, "customFooterCode"),
        customHeaderCode: text(formData, "customHeaderCode"),
        ga4ApiSecret: text(formData, "ga4ApiSecret"),
        ga4ApiSecretCleared: checkbox(formData, "ga4ApiSecretCleared"),
        ga4MeasurementId: text(formData, "ga4MeasurementId"),
        ga4MpEnabled: checkbox(formData, "ga4MpEnabled"),
        googleAdsConversionId: text(formData, "googleAdsConversionId"),
        googleSiteVerification: text(formData, "googleSiteVerification"),
        gtmContainerId: text(formData, "gtmContainerId"),
        metaCapiEnabled: checkbox(formData, "metaCapiEnabled"),
        metaCapiToken: text(formData, "metaCapiToken"),
        metaCapiTokenCleared: checkbox(formData, "metaCapiTokenCleared"),
        metaDomainVerification: text(formData, "metaDomainVerification"),
        metaPixelId: text(formData, "metaPixelId"),
        tiktokPixelId: text(formData, "tiktokPixelId")
      },
      storeId: access.store.id,
      ...(access.organizationId ? { organizationId: access.organizationId } : {}),
      ...(access.userId ? { userId: access.userId } : {})
    });
  } catch (error) {
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
      message: error instanceof Error ? error.message : "Could not save marketing settings.",
      status: "error"
    };
  }

  revalidatePath("/dashboard/settings/marketing");
  // The internal route on purpose: /s/<slug> is what Next serves, and a
  // storefront hostname is a rewrite onto it. Revalidating the clean
  // address would quietly revalidate nothing.
  revalidatePath(`/s/${storeSlug}`);

  return { message: "Marketing settings saved.", status: "success" };
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

    await requirePlanFeature(access.store.id, "pixel_tracking");

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

    await requirePlanFeature(access.store.id, "marketing_analytics");

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
