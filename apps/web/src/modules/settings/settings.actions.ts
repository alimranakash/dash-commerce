"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { uploadMediaAsset } from "../media/media.service";
import { requireStore } from "../stores/queries";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings,
  type StorefrontHeroSlide,
  type StorefrontMenuItem,
  type StorefrontMessage
} from "../storefront/customization";
import { getStoreSettings, updateStoreSettings, updateThemeSettings } from "./settings.service";
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

export async function updateGeneralSettingsFormAction(_state: SettingsActionState, formData: FormData) {
  const store = await requireStore();
  const current = await getStoreSettings(store.id);
  const next: StoreSettingsInput = {
    logoUrl: current.logoUrl ?? undefined,
    faviconUrl: current.faviconUrl ?? undefined,
    tagline: current.tagline ?? undefined,
    contactEmail: current.contactEmail ?? undefined,
    contactPhone: current.contactPhone ?? undefined,
    supportPhone: current.supportPhone ?? undefined,
    businessAddress: current.businessAddress ?? undefined,
    facebookUrl: current.facebookUrl ?? undefined,
    instagramUrl: current.instagramUrl ?? undefined,
    whatsappNumber: current.whatsappNumber ?? undefined
  };

  try {
    const [logoUrl, faviconUrl] = await Promise.all([
      resolveSettingsImageUpload(store.id, formData, "logoFile", "LOGO", getValue(formData, "logoUrl")),
      resolveSettingsImageUpload(store.id, formData, "faviconFile", "FAVICON", getValue(formData, "faviconUrl"))
    ]);

    next.logoUrl = logoUrl;
    next.faviconUrl = faviconUrl;
    next.tagline = getValue(formData, "tagline");
    next.contactEmail = getValue(formData, "contactEmail");
    next.contactPhone = getValue(formData, "contactPhone");
    next.supportPhone = getValue(formData, "supportPhone");
    next.businessAddress = getValue(formData, "businessAddress");

    await updateStoreSettings(store.id, next);
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted general settings.");
  }

  revalidateSettingsPaths(store.slug);
  redirect("/dashboard/settings?updated=1");
}

export async function updateBrandSettingsFormAction(_state: SettingsActionState, formData: FormData) {
  return updateStoreSettingsSection(_state, formData, ["logoUrl", "faviconUrl"], "/dashboard/theme?brandingUpdated=1");
}

export async function updateSocialProfilesFormAction(_state: SettingsActionState, formData: FormData) {
  return updateStoreSettingsSection(_state, formData, ["facebookUrl", "instagramUrl", "whatsappNumber"], "/dashboard/settings/social?updated=1");
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
    tagline: getValue(formData, "tagline"),
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
    advancedSettings: advancedSettingsFromFormData(formData),
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

function advancedSettingsFromFormData(formData: FormData) {
  return normalizeAdvancedSettings({
    announcement: {
      backgroundColor: getValue(formData, "announcementBackgroundColor"),
      enabled: checkbox(formData, "announcementEnabled"),
      fontSize: Number(getValue(formData, "announcementFontSize")),
      messages: parseMessages(getValue(formData, "announcementMessages")),
      scrollSpeed: getValue(formData, "announcementScrollSpeed"),
      textColor: getValue(formData, "announcementTextColor")
    },
    header: {
      backgroundColor: getValue(formData, "headerBackgroundColor"),
      enabled: checkbox(formData, "headerEnabled"),
      height: Number(getValue(formData, "headerHeight")),
      logoText: getValue(formData, "headerLogoText"),
      menuItems: parseMenuItems(getValue(formData, "headerMenuItems")),
      showAccount: checkbox(formData, "headerShowAccount"),
      showCart: checkbox(formData, "headerShowCart"),
      showCurrency: checkbox(formData, "headerShowCurrency"),
      showSearch: checkbox(formData, "headerShowSearch"),
      spacing: Number(getValue(formData, "headerSpacing")),
      sticky: checkbox(formData, "headerSticky"),
      textColor: getValue(formData, "headerTextColor")
    },
    hero: {
      align: getValue(formData, "heroAlign"),
      autoplay: checkbox(formData, "heroAutoplay"),
      button1Link: getValue(formData, "heroButton1Link"),
      button1Text: getValue(formData, "heroButton1Text"),
      button2Link: getValue(formData, "heroButton2Link"),
      button2Text: getValue(formData, "heroButton2Text"),
      buttonStyle: getValue(formData, "heroButtonStyle"),
      contentType: getValue(formData, "heroContentType"),
      customHeight: Number(getValue(formData, "heroCustomHeight")),
      customWidth: Number(getValue(formData, "heroCustomWidth")),
      enabled: checkbox(formData, "heroEnabled"),
      height: getValue(formData, "heroHeight"),
      imageUrl: getValue(formData, "heroImageUrl"),
      layoutWidth: getValue(formData, "heroLayoutWidth"),
      overlayColor: getValue(formData, "heroOverlayColor"),
      overlayOpacity: Number(getValue(formData, "heroOverlayOpacity")),
      showArrows: checkbox(formData, "heroShowArrows"),
      showDots: checkbox(formData, "heroShowDots"),
      sliderSpeed: Number(getValue(formData, "heroSliderSpeed")),
      slides: parseSlides(getValue(formData, "heroSlides")),
      subtitle: getValue(formData, "heroSubtitle"),
      textColor: getValue(formData, "heroTextColor"),
      title: getValue(formData, "heroTitle"),
      videoUrl: getValue(formData, "heroVideoUrl"),
      youtubeUrl: getValue(formData, "heroYoutubeUrl")
    },
    layout: {
      boxedMaxWidth: Number(getValue(formData, "layoutBoxedMaxWidth")),
      pageBackgroundColor: getValue(formData, "layoutPageBackgroundColor"),
      sectionPadding: Number(getValue(formData, "layoutSectionPadding")),
      widthMode: getValue(formData, "layoutWidthMode")
    }
  });
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function parseMenuItems(value: string): StorefrontMenuItem[] {
  const items = value
    .split(/\r?\n/)
    .map((line) => {
      const [label, url] = line.split("|").map((part) => part.trim());

      return label ? { label, url: url || "/" } : null;
    })
    .filter((item): item is StorefrontMenuItem => Boolean(item));

  return items.length > 0 ? items : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.menuItems;
}

function parseMessages(value: string): StorefrontMessage[] {
  const messages = value
    .split(/\r?\n/)
    .map((line): StorefrontMessage | null => {
      const [text, link] = line.split("|").map((part) => part.trim());

      if (!text) {
        return null;
      }

      return link ? { link, text } : { text };
    })
    .filter((item): item is StorefrontMessage => Boolean(item));

  return messages.length > 0 ? messages : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.messages;
}

function parseSlides(value: string): StorefrontHeroSlide[] {
  const slides = value
    .split(/\r?\n/)
    .map((line): StorefrontHeroSlide | null => {
      const [mediaType, url, title, subtitle] = line.split("|").map((part) => part.trim());

      if (!url) {
        return null;
      }

      const slide: StorefrontHeroSlide = {
        mediaType: mediaType === "video" || mediaType === "youtube" ? mediaType : "image",
        url
      };

      if (title) {
        slide.title = title;
      }

      if (subtitle) {
        slide.subtitle = subtitle;
      }

      return slide;
    })
    .filter((item): item is StorefrontHeroSlide => Boolean(item));

  return slides.length > 0 ? slides : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.slides;
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function resolveSettingsImageUpload(
  storeId: string,
  formData: FormData,
  fileField: string,
  usageType: "FAVICON" | "LOGO",
  fallbackUrl: string
) {
  const file = formData.get(fileField);

  if (file instanceof File && file.size > 0) {
    const asset = await uploadMediaAsset({
      alt: usageType === "LOGO" ? "Store logo" : "Store favicon",
      file,
      storeId,
      usageType
    });

    return asset.url;
  }

  return fallbackUrl;
}

async function updateStoreSettingsSection(
  _state: SettingsActionState,
  formData: FormData,
  fields: Array<keyof StoreSettingsInput>,
  redirectTo: string
): Promise<SettingsActionState> {
  const store = await requireStore();
  const current = await getStoreSettings(store.id);
  const next: StoreSettingsInput = {
    logoUrl: current.logoUrl ?? undefined,
    faviconUrl: current.faviconUrl ?? undefined,
    tagline: current.tagline ?? undefined,
    contactEmail: current.contactEmail ?? undefined,
    contactPhone: current.contactPhone ?? undefined,
    supportPhone: current.supportPhone ?? undefined,
    businessAddress: current.businessAddress ?? undefined,
    facebookUrl: current.facebookUrl ?? undefined,
    instagramUrl: current.instagramUrl ?? undefined,
    whatsappNumber: current.whatsappNumber ?? undefined
  };

  for (const field of fields) {
    next[field] = getValue(formData, field);
  }

  try {
    await updateStoreSettings(store.id, next);
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted settings.");
  }

  revalidateSettingsPaths(store.slug);
  redirect(redirectTo);
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
  revalidatePath(`/s/${storeSlug}/cart`);
  revalidatePath(`/s/${storeSlug}/checkout`);
  revalidatePath(`/s/${storeSlug}/categories`);
  revalidatePath(`/s/${storeSlug}/products`);
  revalidatePath(`/s/${storeSlug}/search`);
}
