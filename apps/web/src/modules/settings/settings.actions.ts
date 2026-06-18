"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import { updateStoreSettings, updateThemeSettings } from "./settings.service";
import type { StoreSettingsInput, ThemeSettingsInput } from "./settings.schema";

export type SettingsActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function updateStoreSettingsFormAction(
  _state: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const store = await requireStore();

  try {
    await updateStoreSettings(store.id, storeSettingsFromFormData(formData));
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted store settings.");
  }

  revalidateSettingsPaths(store.slug);
  redirect("/dashboard/settings?updated=1");
}

export async function updateThemeSettingsFormAction(
  _state: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const store = await requireStore();

  try {
    await updateThemeSettings(store.id, themeSettingsFromFormData(formData));
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted theme settings.");
  }

  revalidateSettingsPaths(store.slug);
  redirect("/dashboard/theme?updated=1");
}

function storeSettingsFromFormData(formData: FormData): StoreSettingsInput {
  return {
    logoUrl: getValue(formData, "logoUrl"),
    faviconUrl: getValue(formData, "faviconUrl"),
    contactEmail: getValue(formData, "contactEmail"),
    contactPhone: getValue(formData, "contactPhone"),
    supportPhone: getValue(formData, "supportPhone"),
    businessAddress: getValue(formData, "businessAddress"),
    facebookUrl: getValue(formData, "facebookUrl"),
    instagramUrl: getValue(formData, "instagramUrl"),
    whatsappNumber: getValue(formData, "whatsappNumber")
  };
}

function themeSettingsFromFormData(formData: FormData): ThemeSettingsInput {
  return {
    themeName: "Theme v1",
    primaryColor: getValue(formData, "primaryColor") || "#135d66",
    secondaryColor: getValue(formData, "secondaryColor"),
    heroTitle: getValue(formData, "heroTitle"),
    heroSubtitle: getValue(formData, "heroSubtitle"),
    heroImageUrl: getValue(formData, "heroImageUrl"),
    announcementText: getValue(formData, "announcementText"),
    featuredSectionTitle: getValue(formData, "featuredSectionTitle")
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function settingsErrorState(error: unknown, fallbackMessage: string): SettingsActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: fallbackMessage,
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      )
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "Settings update failed."
  };
}

function revalidateSettingsPaths(storeSlug: string) {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/theme");
  revalidatePath(`/s/${storeSlug}`);
  revalidatePath(`/s/${storeSlug}/products`);
}
