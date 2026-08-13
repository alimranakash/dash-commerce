"use server";

import { revalidatePath } from "next/cache";
import { StoreAccessError, requireStoreManager } from "../stores/queries";
import { MarketingSettingsError, updateMarketingSettings } from "./marketing.service";

export type MarketingActionState = {
  fieldErrors?: Record<string, string>;
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

    await updateMarketingSettings({
      input: {
        customBodyCode: text(formData, "customBodyCode"),
        customEnabled: checkbox(formData, "customEnabled"),
        customFooterCode: text(formData, "customFooterCode"),
        customHeaderCode: text(formData, "customHeaderCode"),
        ga4MeasurementId: text(formData, "ga4MeasurementId"),
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

    if (error instanceof MarketingSettingsError) {
      return { fieldErrors: error.fieldErrors, message: error.message, status: "error" };
    }

    return {
      message: error instanceof Error ? error.message : "Could not save marketing settings.",
      status: "error"
    };
  }

  revalidatePath("/dashboard/settings/marketing");
  revalidatePath(`/s/${storeSlug}`);

  return { message: "Marketing settings saved.", status: "success" };
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}
