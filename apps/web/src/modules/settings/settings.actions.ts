"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import type { MediaUsageType } from "../media/media.schema";
import { uploadMediaAsset } from "../media/media.service";
import { requireStore } from "../stores/queries";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings,
  type StorefrontHeroSlide,
  type StorefrontMenuItem,
  type StorefrontMessage,
  type StorefrontProductSectionSettings,
  type StorefrontTabbedProductTab
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
    await updateStoreSettings(store.id, next);
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted branding settings.");
  }

  revalidateSettingsPaths(store.slug);
  redirect("/dashboard/storefront/themes?brandingUpdated=1");
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
    await updateThemeSettings(store.id, await themeSettingsFromFormData(store.id, formData));
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted theme settings.");
  }

  revalidateSettingsPaths(store.slug);
  redirect("/dashboard/storefront/themes?updated=1");
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

async function themeSettingsFromFormData(storeId: string, formData: FormData): Promise<ThemeSettingsInput> {
  const heroImageUrl = await resolveSettingsImageUpload(
    storeId,
    formData,
    "heroImageFile",
    "HERO",
    getValue(formData, "heroImageUrl")
  );

  return {
    advancedSettings: await advancedSettingsFromFormData(storeId, formData, heroImageUrl),
    themeName: "Theme v1",
    primaryColor: getValue(formData, "primaryColor") || "#135d66",
    secondaryColor: getValue(formData, "secondaryColor"),
    heroTitle: getValue(formData, "heroTitle"),
    heroSubtitle: getValue(formData, "heroSubtitle"),
    heroImageUrl,
    announcementText: getValue(formData, "announcementText"),
    featuredSectionTitle: getValue(formData, "featuredSectionTitle")
  };
}

async function advancedSettingsFromFormData(storeId: string, formData: FormData, heroImageUrl: string) {
  const slides = await parseSlides(storeId, formData);

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
      imageUrl: heroImageUrl,
      layoutWidth: getValue(formData, "heroLayoutWidth"),
      overlayColor: getValue(formData, "heroOverlayColor"),
      overlayOpacity: Number(getValue(formData, "heroOverlayOpacity")),
      showArrows: checkbox(formData, "heroShowArrows"),
      showDots: checkbox(formData, "heroShowDots"),
      sliderSpeed: Number(getValue(formData, "heroSliderSpeed")),
      slides,
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
    },
    cartPage: {
      breadcrumbEnabled: checkbox(formData, "cartBreadcrumbEnabled"),
      checkoutButtonBackgroundColor: getValue(formData, "cartCheckoutButtonBackgroundColor"),
      checkoutButtonBorderRadius: Number(getValue(formData, "cartCheckoutButtonBorderRadius")),
      checkoutButtonText: getValue(formData, "cartCheckoutButtonText"),
      checkoutButtonTextColor: getValue(formData, "cartCheckoutButtonTextColor"),
      continueShoppingLink: getValue(formData, "cartContinueShoppingLink"),
      estimatedDeliveryEnabled: checkbox(formData, "cartEstimatedDeliveryEnabled"),
      freeShippingAmount: Number(getValue(formData, "cartFreeShippingAmount")),
      freeShippingCtaLink: getValue(formData, "cartFreeShippingCtaLink"),
      freeShippingCtaText: getValue(formData, "cartFreeShippingCtaText"),
      freeShippingEnabled: checkbox(formData, "cartFreeShippingEnabled"),
      freeShippingText: getValue(formData, "cartFreeShippingText"),
      orderNotesEnabled: checkbox(formData, "cartOrderNotesEnabled"),
      showBrand: checkbox(formData, "cartShowBrand"),
      showRemoveButton: checkbox(formData, "cartShowRemoveButton"),
      showVariant: checkbox(formData, "cartShowVariant"),
      taxesEnabled: checkbox(formData, "cartTaxesEnabled"),
      widthMode: getValue(formData, "cartWidthMode")
    },
    miniCart: {
      autoOpenAfterAdd: checkbox(formData, "miniCartAutoOpenAfterAdd"),
      checkoutButtonBackgroundColor: getValue(formData, "miniCartCheckoutButtonBackgroundColor"),
      checkoutButtonBorderRadius: Number(getValue(formData, "miniCartCheckoutButtonBorderRadius")),
      checkoutButtonEnabled: checkbox(formData, "miniCartCheckoutButtonEnabled"),
      checkoutButtonText: getValue(formData, "miniCartCheckoutButtonText"),
      checkoutButtonTextColor: getValue(formData, "miniCartCheckoutButtonTextColor"),
      drawerWidth: Number(getValue(formData, "miniCartDrawerWidth")),
      enabled: checkbox(formData, "miniCartEnabled"),
      freeShippingAmount: Number(getValue(formData, "miniCartFreeShippingAmount")),
      freeShippingCtaLink: getValue(formData, "miniCartFreeShippingCtaLink"),
      freeShippingCtaText: getValue(formData, "miniCartFreeShippingCtaText"),
      freeShippingEnabled: checkbox(formData, "miniCartFreeShippingEnabled"),
      freeShippingText: getValue(formData, "miniCartFreeShippingText"),
      orderNotesEnabled: checkbox(formData, "miniCartOrderNotesEnabled"),
      overlayOpacity: Number(getValue(formData, "miniCartOverlayOpacity")),
      showBrand: checkbox(formData, "miniCartShowBrand"),
      showItemCount: checkbox(formData, "miniCartShowItemCount"),
      showQuantity: checkbox(formData, "miniCartShowQuantity"),
      showRemoveButton: checkbox(formData, "miniCartShowRemoveButton"),
      showVariant: checkbox(formData, "miniCartShowVariant"),
      viewCartButtonEnabled: checkbox(formData, "miniCartViewCartButtonEnabled"),
      viewCartButtonLink: getValue(formData, "miniCartViewCartButtonLink"),
      viewCartButtonText: getValue(formData, "miniCartViewCartButtonText")
    },
    productSections: {
      bestSellers: productSectionFromFormData(formData, "bestSellers"),
      featured: productSectionFromFormData(formData, "featured"),
      listing: productSectionFromFormData(formData, "listing"),
      newArrivals: productSectionFromFormData(formData, "newArrivals"),
      related: productSectionFromFormData(formData, "related"),
      recentlyViewed: productSectionFromFormData(formData, "recentlyViewed"),
      search: productSectionFromFormData(formData, "search"),
      trending: productSectionFromFormData(formData, "trending")
    },
    productPage: {
      accordionEnabled: checkbox(formData, "productPageAccordionEnabled"),
      addToCartButtonColor: getValue(formData, "productPageAddToCartButtonColor"),
      addToCartButtonRadius: Number(getValue(formData, "productPageAddToCartButtonRadius")),
      addToCartText: getValue(formData, "productPageAddToCartText"),
      breadcrumbEnabled: checkbox(formData, "productPageBreadcrumbEnabled"),
      buyNowEnabled: checkbox(formData, "productPageBuyNowEnabled"),
      galleryLayout: getValue(formData, "productPageGalleryLayout"),
      gallerySpacing: Number(getValue(formData, "productPageGallerySpacing")),
      imageRatio: getValue(formData, "productPageImageRatio"),
      lightboxEnabled: checkbox(formData, "productPageLightboxEnabled"),
      promoBlocksEnabled: checkbox(formData, "productPagePromoBlocksEnabled"),
      shippingEnabled: checkbox(formData, "productPageShippingEnabled"),
      shippingNotice: getValue(formData, "productPageShippingNotice"),
      variantEnabled: checkbox(formData, "productPageVariantEnabled"),
      variantStyle: getValue(formData, "productPageVariantStyle"),
      zoomEnabled: checkbox(formData, "productPageZoomEnabled")
    },
    shopPage: {
      defaultSort: getValue(formData, "shopDefaultSort"),
      description: getValue(formData, "shopDescription"),
      descriptionEnabled: checkbox(formData, "shopDescriptionEnabled"),
      enableAvailabilityFilter: checkbox(formData, "shopEnableAvailabilityFilter"),
      enableBrandFilter: checkbox(formData, "shopEnableBrandFilter"),
      enableCategoryFilter: checkbox(formData, "shopEnableCategoryFilter"),
      enableColorFilter: checkbox(formData, "shopEnableColorFilter"),
      enableCollectionFilter: checkbox(formData, "shopEnableCollectionFilter"),
      enableComparePrice: checkbox(formData, "shopEnableComparePrice"),
      enableFilters: checkbox(formData, "shopEnableFilters"),
      enableHoverImage: checkbox(formData, "shopEnableHoverImage"),
      enableProductBadges: checkbox(formData, "shopEnableProductBadges"),
      enableProductBrand: checkbox(formData, "shopEnableProductBrand"),
      enableProductColorCount: checkbox(formData, "shopEnableProductColorCount"),
      enablePriceFilter: checkbox(formData, "shopEnablePriceFilter"),
      enableQuickView: checkbox(formData, "shopEnableQuickView"),
      enableSizeFilter: checkbox(formData, "shopEnableSizeFilter"),
      enableSorting: checkbox(formData, "shopEnableSorting"),
      enableTagFilter: checkbox(formData, "shopEnableTagFilter"),
      enableResultCounter: checkbox(formData, "shopEnableResultCounter"),
      gridSpacing: Number(getValue(formData, "shopGridSpacing")),
      paginationMode: getValue(formData, "shopPaginationMode"),
      pageTitle: getValue(formData, "shopPageTitle"),
      productsPerPage: Number(getValue(formData, "shopProductsPerPage")),
      productsPerRow: Number(getValue(formData, "shopProductsPerRow")),
      sectionSpacing: Number(getValue(formData, "shopSectionSpacing")),
      sortOptions: parseShopSortOptions(getValue(formData, "shopSortOptions")),
      widthMode: getValue(formData, "shopWidthMode")
    },
    tabbedProductShowcase: {
      arrowsVisible: checkbox(formData, "tabbedShowcaseArrowsVisible"),
      autoplay: checkbox(formData, "tabbedShowcaseAutoplay"),
      backgroundColor: getValue(formData, "tabbedShowcaseBackgroundColor"),
      defaultActiveTab: Number(getValue(formData, "tabbedShowcaseDefaultActiveTab")),
      description: getValue(formData, "tabbedShowcaseDescription"),
      enabled: checkbox(formData, "tabbedShowcaseEnabled"),
      fullWidth: checkbox(formData, "tabbedShowcaseFullWidth"),
      infiniteLoop: checkbox(formData, "tabbedShowcaseInfiniteLoop"),
      productsPerTab: Number(getValue(formData, "tabbedShowcaseProductsPerTab")),
      productsPerView: Number(getValue(formData, "tabbedShowcaseProductsPerView")),
      scrollAmount: getValue(formData, "tabbedShowcaseScrollAmount"),
      sectionSpacing: Number(getValue(formData, "tabbedShowcaseSectionSpacing")),
      sliderEnabled: checkbox(formData, "tabbedShowcaseSliderEnabled"),
      tabs: parseTabbedProductTabs(getValue(formData, "tabbedShowcaseTabs")),
      title: getValue(formData, "tabbedShowcaseTitle")
    }
  });
}

function productSectionFromFormData(
  formData: FormData,
  key: keyof typeof DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections
): StorefrontProductSectionSettings {
  const fallback = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections[key];

  return {
    columns: Number(getValue(formData, `productSection_${key}_columns`)) as 2 | 3 | 4 | 5,
    count: Number(getValue(formData, `productSection_${key}_count`)),
    ctaLink: getValue(formData, `productSection_${key}_ctaLink`) || fallback.ctaLink,
    ctaText: getValue(formData, `productSection_${key}_ctaText`) || fallback.ctaText,
    enableBadges: checkbox(formData, `productSection_${key}_enableBadges`),
    enableComparePrice: checkbox(formData, `productSection_${key}_enableComparePrice`),
    enableHoverImage: checkbox(formData, `productSection_${key}_enableHoverImage`),
    enableVariants: checkbox(formData, `productSection_${key}_enableVariants`),
    mode: getValue(formData, `productSection_${key}_mode`) as StorefrontProductSectionSettings["mode"],
    source: getValue(formData, `productSection_${key}_source`) as StorefrontProductSectionSettings["source"],
    subtitle: getValue(formData, `productSection_${key}_subtitle`) || fallback.subtitle,
    title: getValue(formData, `productSection_${key}_title`) || fallback.title
  };
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

function parseTabbedProductTabs(value: string): StorefrontTabbedProductTab[] {
  const tabs = value
    .split(/\r?\n/)
    .map((line): StorefrontTabbedProductTab | null => {
      const [label, source, count, enabled] = line.split("|").map((part) => part.trim());

      if (!label) {
        return null;
      }

      return {
        enabled: enabled ? enabled.toLowerCase() !== "false" : true,
        label,
        productCount: Number(count) || DEFAULT_STOREFRONT_ADVANCED_SETTINGS.tabbedProductShowcase.productsPerTab,
        source: source as StorefrontTabbedProductTab["source"]
      };
    })
    .filter((item): item is StorefrontTabbedProductTab => Boolean(item));

  return tabs.length > 0 ? tabs : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.tabbedProductShowcase.tabs;
}

function parseShopSortOptions(value: string) {
  const options = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return options.length > 0 ? options : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.shopPage.sortOptions;
}

async function parseSlides(storeId: string, formData: FormData): Promise<StorefrontHeroSlide[]> {
  const slides: StorefrontHeroSlide[] = [];

  for (let index = 0; index < 4; index += 1) {
    const url = await resolveSettingsImageUpload(
      storeId,
      formData,
      `heroSlideImageFile${index}`,
      "HERO",
      getValue(formData, `heroSlideImageUrl${index}`)
    );
    const youtubeUrl = getValue(formData, `heroSlideYoutubeUrl${index}`);
    const videoUrl = getValue(formData, `heroSlideVideoUrl${index}`);
    const title = getValue(formData, `heroSlideTitle${index}`);
    const subtitle = getValue(formData, `heroSlideSubtitle${index}`);
    const mediaType = getValue(formData, `heroSlideMediaType${index}`);

    const slideUrl = mediaType === "youtube" ? youtubeUrl : mediaType === "video" ? videoUrl : url;

    if (!slideUrl) {
      continue;
    }

    const slide: StorefrontHeroSlide = {
      mediaType: mediaType === "video" || mediaType === "youtube" ? mediaType : "image",
      url: slideUrl
    };

    if (title) {
      slide.title = title;
    }

    if (subtitle) {
      slide.subtitle = subtitle;
    }

    slides.push(slide);
  }

  return slides.length > 0 ? slides : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.slides;
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function resolveSettingsImageUpload(
  storeId: string,
  formData: FormData,
  fileField: string,
  usageType: MediaUsageType,
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
  revalidatePath("/dashboard/storefront/themes");
  revalidatePath(`/s/${storeSlug}`);
  revalidatePath(`/s/${storeSlug}/cart`);
  revalidatePath(`/s/${storeSlug}/checkout`);
  revalidatePath(`/s/${storeSlug}/categories`);
  revalidatePath(`/s/${storeSlug}/products`);
  revalidatePath(`/s/${storeSlug}/search`);
}
