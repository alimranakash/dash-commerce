"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { hasPlanFeature } from "../billing/subscription-limits";
import { requireStoreManager } from "../stores/queries";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  FOOTER_COLUMN_SLOTS,
  normalizeAdvancedSettings,
  type StorefrontFooterColumnSetting,
  type StorefrontHeroSlide,
  type StorefrontLinkSetting,
  type StorefrontMenuItem,
  type StorefrontMessage,
  type StorefrontElectronicsPromoCardSettings,
  type StorefrontElectronicsHomepageSettings,
  type StorefrontFashionHomepageSettings,
  type StorefrontProductSectionSettings,
  type StorefrontTabbedProductTab
} from "../storefront/customization";
import {
  getStoreSettings,
  updateInvoiceSettings,
  updateSocialLoginSettings,
  updateSocialProfileLinks,
  updateStoreSettings,
  updateThemeSettings
} from "./settings.service";
import type { StoreSettingsInput, ThemeSettingsInput } from "./settings.schema";

export type SettingsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  toastId?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Every action in this file changes how the store presents itself to customers,
 * so all of them are manager-only. `requireStoreManager()` throws rather than
 * redirecting, which is why each guard sits inside the `try` — the seller sees
 * the refusal in the form instead of a blank error page. `settingsErrorState`
 * already reports any `Error.message`, and `StoreAccessError` carries the
 * explanation, so it needs no special case.
 */
export async function updateStoreSettingsFormAction(
  _state: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  let storeSlug: string;

  try {
    const { store } = await requireStoreManager();

    storeSlug = store.slug;
    await updateStoreSettings(store.id, storeSettingsFromFormData(formData));
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted store settings.");
  }

  revalidateSettingsPaths(storeSlug);
  redirect("/dashboard/settings?updated=1");
}

export async function updateGeneralSettingsFormAction(
  _state: SettingsActionState,
  formData: FormData
) {
  let storeSlug: string;

  try {
    const { store } = await requireStoreManager();
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

    storeSlug = store.slug;
    next.logoUrl = getValue(formData, "logoUrl");
    next.faviconUrl = getValue(formData, "faviconUrl");
    next.tagline = getValue(formData, "tagline");
    next.contactEmail = getValue(formData, "contactEmail");
    next.contactPhone = getValue(formData, "contactPhone");
    next.supportPhone = getValue(formData, "supportPhone");
    next.businessAddress = getValue(formData, "businessAddress");

    await updateStoreSettings(store.id, next);
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted general settings.");
  }

  revalidateSettingsPaths(storeSlug);
  redirect("/dashboard/settings?updated=1");
}

export async function updateBrandSettingsFormAction(
  _state: SettingsActionState,
  formData: FormData
) {
  let storeSlug: string;

  try {
    const { store } = await requireStoreManager();
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

    storeSlug = store.slug;
    next.logoUrl = getValue(formData, "logoUrl");
    next.faviconUrl = getValue(formData, "faviconUrl");
    await updateStoreSettings(store.id, next);
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted branding settings.");
  }

  revalidateSettingsPaths(storeSlug);
  return settingsSuccessState("Store branding updated.");
}

export async function updateSocialProfilesFormAction(
  _state: SettingsActionState,
  formData: FormData
) {
  let storeSlug: string;

  try {
    const { store } = await requireStoreManager();
    const current = await getStoreSettings(store.id);
    const next: StoreSettingsInput = {
      logoUrl: current.logoUrl ?? undefined,
      faviconUrl: current.faviconUrl ?? undefined,
      tagline: current.tagline ?? undefined,
      contactEmail: current.contactEmail ?? undefined,
      contactPhone: current.contactPhone ?? undefined,
      supportPhone: current.supportPhone ?? undefined,
      businessAddress: current.businessAddress ?? undefined,
      facebookUrl: getValue(formData, "facebookUrl"),
      instagramUrl: getValue(formData, "instagramUrl"),
      whatsappNumber: getValue(formData, "whatsappNumber")
    };

    storeSlug = store.slug;
    await updateStoreSettings(store.id, next);
    await updateSocialProfileLinks(store.id, {
      linkedinUrl: getValue(formData, "linkedinUrl"),
      tiktokUrl: getValue(formData, "tiktokUrl"),
      twitterUrl: getValue(formData, "twitterUrl"),
      youtubeUrl: getValue(formData, "youtubeUrl")
    });
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted social profiles.");
  }

  revalidateSettingsPaths(storeSlug);
  redirect("/dashboard/settings/social?updated=1");
}

// Marketing settings are no longer written here. They live in the
// MarketingSetting table behind a role gate and are saved through
// modules/marketing/marketing.actions.ts.

// Courier credentials are no longer written here. They live in the encrypted
// CourierAccount table and are saved through modules/courier/courier.actions.ts,
// so there is exactly one write path and it cannot store plaintext secrets.

export async function updateInvoiceSettingsFormAction(
  _state: SettingsActionState,
  formData: FormData
) {
  let storeSlug: string;

  try {
    const { store } = await requireStoreManager();

    storeSlug = store.slug;
    await updateInvoiceSettings(store.id, {
      autoGenerateNumber: checkbox(formData, "autoGenerateNumber"),
      companyLogoUrl: getValue(formData, "companyLogoUrl"),
      companyName: getValue(formData, "companyName"),
      contactEmail: getValue(formData, "contactEmail"),
      contactPhone: getValue(formData, "contactPhone"),
      footerNote: getValue(formData, "footerNote"),
      invoiceAddressHtml: getValue(formData, "invoiceAddressHtml"),
      invoicePrefix: getValue(formData, "invoicePrefix") || "INV",
      showCustomerEmail: checkbox(formData, "showCustomerEmail"),
      showCustomerPhone: checkbox(formData, "showCustomerPhone"),
      showStoreLogo: checkbox(formData, "showStoreLogo"),
      showTaxBreakdown: checkbox(formData, "showTaxBreakdown"),
      startingInvoiceNumber: Number(getValue(formData, "startingInvoiceNumber") || 1),
      taxEnabled: checkbox(formData, "taxEnabled"),
      taxLabel: getValue(formData, "taxLabel"),
      taxPercentage: Number(getValue(formData, "taxPercentage") || 0),
      thankYouMessage: getValue(formData, "thankYouMessage"),
      vatNumber: getValue(formData, "vatNumber"),
      websiteUrl: getValue(formData, "websiteUrl")
    });
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted invoice settings.");
  }

  revalidateSettingsPaths(storeSlug);
  return settingsSuccessState("Invoice settings saved.");
}

export async function updateSocialLoginSettingsFormAction(
  _state: SettingsActionState,
  formData: FormData
) {
  let storeSlug: string;

  try {
    const { store } = await requireStoreManager();

    storeSlug = store.slug;
    await updateSocialLoginSettings(store.id, {
      facebookAppId: getValue(formData, "facebookAppId"),
      facebookAppSecret: getValue(formData, "facebookAppSecret"),
      facebookEnabled: checkbox(formData, "facebookEnabled"),
      googleClientId: getValue(formData, "googleClientId"),
      googleClientSecret: getValue(formData, "googleClientSecret"),
      googleEnabled: checkbox(formData, "googleEnabled")
    });
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted social login settings.");
  }

  revalidateSettingsPaths(storeSlug);
  return settingsSuccessState("Social login settings saved.");
}

export async function updateThemeSettingsFormAction(
  _state: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  let storeSlug: string;

  try {
    const { store } = await requireStoreManager();

    storeSlug = store.slug;

    const input = themeSettingsFromFormData(formData);

    // The footer credit is not editable without `footer_branding`. The form
    // renders that field disabled, and a disabled input posts nothing — but a
    // hand-made request can still carry one, so the value is replaced here
    // rather than trusted. Refusing the whole save would lose the seller's
    // other theme edits over a field they were never offered.
    if (input.advancedSettings && !(await hasPlanFeature(store.id, "footer_branding"))) {
      input.advancedSettings.footer = {
        ...input.advancedSettings.footer,
        copyrightText: DEFAULT_STOREFRONT_ADVANCED_SETTINGS.footer.copyrightText
      };
    }

    await updateThemeSettings(store.id, input);
  } catch (error) {
    return settingsErrorState(error, "Please fix the highlighted theme settings.");
  }

  revalidateSettingsPaths(storeSlug);
  return settingsSuccessState("Theme settings updated.");
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

// Hero and slide images come from the media picker already uploaded, so this
// only ever reads URLs.
function themeSettingsFromFormData(formData: FormData): ThemeSettingsInput {
  const heroImageUrl = getValue(formData, "heroImageUrl");

  return {
    advancedSettings: advancedSettingsFromFormData(formData, heroImageUrl),
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

function advancedSettingsFromFormData(formData: FormData, heroImageUrl: string) {
  const slides = parseSlides(formData);

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
    footer: {
      columns: parseFooterColumns(formData),
      copyrightText: getValue(formData, "footerCopyrightText"),
      description: getValue(formData, "footerDescription"),
      enabled: checkbox(formData, "footerEnabled"),
      paymentIcons: parseTextList(getValue(formData, "footerPaymentIcons")),
      paymentIconsEnabled: checkbox(formData, "footerPaymentIconsEnabled"),
      showSocialIcons: checkbox(formData, "footerShowSocialIcons")
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
    electronics: {
      brandSectionTitle: getValue(formData, "electronicsBrandSectionTitle"),
      categorySectionTitle: getValue(formData, "electronicsCategorySectionTitle"),
      featuredSectionTitle: getValue(formData, "electronicsFeaturedSectionTitle"),
      flashDealEyebrow: getValue(formData, "electronicsFlashDealEyebrow"),
      flashDealTitle: getValue(formData, "electronicsFlashDealTitle"),
      footerCollectionLinks: parseLinks(getValue(formData, "electronicsFooterCollectionLinks")),
      footerInformationLinks: parseLinks(getValue(formData, "electronicsFooterInformationLinks")),
      heroPromoCards: parseElectronicsPromoCards(getValue(formData, "electronicsHeroPromoCards")),
      newArrivalsTitle: getValue(formData, "electronicsNewArrivalsTitle"),
      newsletterDescription: getValue(formData, "electronicsNewsletterDescription"),
      newsletterTitle: getValue(formData, "electronicsNewsletterTitle"),
      promoCards: parseElectronicsPromoCards(getValue(formData, "electronicsPromoCards")),
      promoSectionTitle: getValue(formData, "electronicsPromoSectionTitle"),
      recommendedTitle: getValue(formData, "electronicsRecommendedTitle"),
      supportText: getValue(formData, "electronicsSupportText"),
      trustItems: parseTrustItems(getValue(formData, "electronicsTrustItems"))
    },
    fashion: {
      beforeAfterAfterImageUrl: getValue(formData, "fashionBeforeAfterAfterImageUrl"),
      beforeAfterAfterLabel: getValue(formData, "fashionBeforeAfterAfterLabel"),
      beforeAfterBeforeImageUrl: getValue(formData, "fashionBeforeAfterBeforeImageUrl"),
      beforeAfterBeforeLabel: getValue(formData, "fashionBeforeAfterBeforeLabel"),
      beforeAfterInitialPosition: Number(getValue(formData, "fashionBeforeAfterInitialPosition")),
      collectionCtas: parseTextList(getValue(formData, "fashionCollectionCtas")),
      communityDescription: getValue(formData, "fashionCommunityDescription"),
      communityImages: parseTextList(getValue(formData, "fashionCommunityImages")),
      communityTitle: getValue(formData, "fashionCommunityTitle"),
      editorialBannerCtaLink: getValue(formData, "fashionEditorialBannerCtaLink"),
      editorialBannerCtaText: getValue(formData, "fashionEditorialBannerCtaText"),
      editorialBannerImageUrl: getValue(formData, "fashionEditorialBannerImageUrl"),
      editorialBannerSubtitle: getValue(formData, "fashionEditorialBannerSubtitle"),
      editorialBannerTitle: getValue(formData, "fashionEditorialBannerTitle"),
      editorialSplitCtaLink: getValue(formData, "fashionEditorialSplitCtaLink"),
      editorialSplitCtaText: getValue(formData, "fashionEditorialSplitCtaText"),
      editorialSplitHeading: getValue(formData, "fashionEditorialSplitHeading"),
      editorialSplitHeight: Number(getValue(formData, "fashionEditorialSplitHeight")),
      editorialSplitLeftImageUrl: getValue(formData, "fashionEditorialSplitLeftImageUrl"),
      editorialSplitOverlayOpacity: Number(
        getValue(formData, "fashionEditorialSplitOverlayOpacity")
      ),
      editorialSplitRightImageUrl: getValue(formData, "fashionEditorialSplitRightImageUrl"),
      featuredLookCtaLink: getValue(formData, "fashionFeaturedLookCtaLink"),
      featuredLookCtaText: getValue(formData, "fashionFeaturedLookCtaText"),
      featuredLookDescription: getValue(formData, "fashionFeaturedLookDescription"),
      featuredLookImageUrl: getValue(formData, "fashionFeaturedLookImageUrl"),
      featuredLookTitle: getValue(formData, "fashionFeaturedLookTitle"),
      footerAboutLinks: parseLinks(getValue(formData, "fashionFooterAboutLinks")),
      footerDescription: getValue(formData, "fashionFooterDescription"),
      footerLegalLinks: parseLinks(getValue(formData, "fashionFooterLegalLinks")),
      footerNewsletterDescription: getValue(formData, "fashionFooterNewsletterDescription"),
      footerNewsletterTitle: getValue(formData, "fashionFooterNewsletterTitle"),
      footerPressLogos: parseTextList(getValue(formData, "fashionFooterPressLogos")),
      footerShopLinks: parseLinks(getValue(formData, "fashionFooterShopLinks")),
      newArrivalsDescription: getValue(formData, "fashionNewArrivalsDescription"),
      newArrivalsTitle: getValue(formData, "fashionNewArrivalsTitle"),
      newsletterButtonText: getValue(formData, "fashionNewsletterButtonText"),
      newsletterDescription: getValue(formData, "fashionNewsletterDescription"),
      newsletterImageUrl: getValue(formData, "fashionNewsletterImageUrl"),
      newsletterTitle: getValue(formData, "fashionNewsletterTitle")
    },
    productPage: {
      accordionEnabled: checkbox(formData, "productPageAccordionEnabled"),
      addToCartButtonColor: getValue(formData, "productPageAddToCartButtonColor"),
      addToCartButtonRadius: Number(getValue(formData, "productPageAddToCartButtonRadius")),
      addToCartText: getValue(formData, "productPageAddToCartText"),
      breadcrumbEnabled: checkbox(formData, "productPageBreadcrumbEnabled"),
      directCheckoutEnabled: checkbox(formData, "productPageDirectCheckoutEnabled"),
      directCheckoutText: getValue(formData, "productPageDirectCheckoutText"),
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
    quickView: {
      buttonLabel: getValue(formData, "quickViewButtonLabel"),
      descriptionEnabled: checkbox(formData, "quickViewDescriptionEnabled"),
      descriptionLength: Number(getValue(formData, "quickViewDescriptionLength")),
      directCheckoutEnabled: checkbox(formData, "quickViewDirectCheckoutEnabled"),
      enabled: checkbox(formData, "quickViewEnabled"),
      fullDetailsText: getValue(formData, "quickViewFullDetailsText"),
      galleryEnabled: checkbox(formData, "quickViewGalleryEnabled"),
      quantityEnabled: checkbox(formData, "quickViewQuantityEnabled"),
      triggerStyle: getValue(formData, "quickViewTriggerStyle"),
      variantEnabled: checkbox(formData, "quickViewVariantEnabled"),
      wishlistEnabled: checkbox(formData, "quickViewWishlistEnabled")
    },
    shopPage: {
      defaultSort: getValue(formData, "shopDefaultSort"),
      description: getValue(formData, "shopDescription"),
      descriptionEnabled: checkbox(formData, "shopDescriptionEnabled"),
      enableAvailabilityFilter: checkbox(formData, "shopEnableAvailabilityFilter"),
      enableBrandFilter: checkbox(formData, "shopEnableBrandFilter"),
      enableCategoryFilter: checkbox(formData, "shopEnableCategoryFilter"),
      enableComparePrice: checkbox(formData, "shopEnableComparePrice"),
      enableFilters: checkbox(formData, "shopEnableFilters"),
      enableHoverImage: checkbox(formData, "shopEnableHoverImage"),
      enableProductBadges: checkbox(formData, "shopEnableProductBadges"),
      enablePriceFilter: checkbox(formData, "shopEnablePriceFilter"),
      enableSorting: checkbox(formData, "shopEnableSorting"),
      enableTagFilter: checkbox(formData, "shopEnableTagFilter"),
      enableResultCounter: checkbox(formData, "shopEnableResultCounter"),
      filterLayout: getValue(formData, "shopFilterLayout"),
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

// Each footer column is a title input plus one "Label | /path" textarea, so a
// column with no title is simply dropped rather than saved empty.
function parseFooterColumns(formData: FormData): StorefrontFooterColumnSetting[] {
  const columns: StorefrontFooterColumnSetting[] = [];

  for (let index = 0; index < FOOTER_COLUMN_SLOTS; index += 1) {
    const title = getValue(formData, `footerColumnTitle${index}`);

    if (!title) {
      continue;
    }

    columns.push({
      links: parseLinks(getValue(formData, `footerColumnLinks${index}`)),
      title
    });
  }

  return columns;
}

function parseLinks(value: string): StorefrontLinkSetting[] {
  return value
    .split(/\r?\n/)
    .map((line): StorefrontLinkSetting | null => {
      const [label, url] = line.split("|").map((part) => part.trim());

      return label ? { label, url: url || "/" } : null;
    })
    .filter((item): item is StorefrontLinkSetting => Boolean(item));
}

function parseElectronicsPromoCards(value: string): StorefrontElectronicsPromoCardSettings[] {
  return value
    .split(/\r?\n/)
    .map((line): StorefrontElectronicsPromoCardSettings | null => {
      const [title, badge, description, imageUrl, ctaText, ctaLink, backgroundColor] = line
        .split("|")
        .map((part) => part.trim());

      if (!title) {
        return null;
      }

      return {
        backgroundColor: backgroundColor || "#f7f8fb",
        badge: badge || "",
        ctaLink: ctaLink || "/products",
        ctaText: ctaText || "Shop now",
        description: description || "",
        imageUrl: imageUrl || "",
        title
      };
    })
    .filter((item): item is StorefrontElectronicsPromoCardSettings => Boolean(item));
}

function parseTrustItems(value: string): StorefrontElectronicsHomepageSettings["trustItems"] {
  return value
    .split(/\r?\n/)
    .map((line): StorefrontElectronicsHomepageSettings["trustItems"][number] | null => {
      const [title, description] = line.split("|").map((part) => part.trim());

      return title ? { title, description: description || "" } : null;
    })
    .filter((item): item is StorefrontElectronicsHomepageSettings["trustItems"][number] =>
      Boolean(item)
    );
}

function parseTextList(value: string): StorefrontFashionHomepageSettings["collectionCtas"] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function productSectionFromFormData(
  formData: FormData,
  key: keyof typeof DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections
): StorefrontProductSectionSettings {
  const fallback = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections[key];
  // A section that does not offer a control (product source on the shop grid,
  // for example) submits no field for it, which must keep the default rather
  // than parse an empty string into 0.
  const columns = getValue(formData, `productSection_${key}_columns`);
  const count = getValue(formData, `productSection_${key}_count`);

  return {
    columns: columns ? (Number(columns) as 2 | 3 | 4 | 5) : fallback.columns,
    count: count ? Number(count) : fallback.count,
    ctaLink: getValue(formData, `productSection_${key}_ctaLink`) || fallback.ctaLink,
    ctaText: getValue(formData, `productSection_${key}_ctaText`) || fallback.ctaText,
    enableBadges: checkbox(formData, `productSection_${key}_enableBadges`),
    enableComparePrice: checkbox(formData, `productSection_${key}_enableComparePrice`),
    enableHoverImage: checkbox(formData, `productSection_${key}_enableHoverImage`),
    enableVariants: checkbox(formData, `productSection_${key}_enableVariants`),
    mode: (getValue(formData, `productSection_${key}_mode`) ||
      fallback.mode) as StorefrontProductSectionSettings["mode"],
    source: (getValue(formData, `productSection_${key}_source`) ||
      fallback.source) as StorefrontProductSectionSettings["source"],
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

  return messages.length > 0
    ? messages
    : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.messages;
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
        productCount:
          Number(count) ||
          DEFAULT_STOREFRONT_ADVANCED_SETTINGS.tabbedProductShowcase.productsPerTab,
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

function parseSlides(formData: FormData): StorefrontHeroSlide[] {
  const slides: StorefrontHeroSlide[] = [];

  for (let index = 0; index < 4; index += 1) {
    const url = getValue(formData, `heroSlideImageUrl${index}`);
    const youtubeUrl = getValue(formData, `heroSlideYoutubeUrl${index}`);
    const videoUrl = getValue(formData, `heroSlideVideoUrl${index}`);
    const title = getValue(formData, `heroSlideTitle${index}`);
    const subtitle = getValue(formData, `heroSlideSubtitle${index}`);
    const mediaType = getValue(formData, `heroSlideMediaType${index}`);

    const slideUrl = mediaType === "youtube" ? youtubeUrl : mediaType === "video" ? videoUrl : url;

    // A slide is empty only when the seller filled in nothing at all. Copy
    // without media is still a slide - the hero renders its own backdrop.
    if (!slideUrl && !title && !subtitle) {
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

function settingsErrorState(error: unknown, fallbackMessage: string): SettingsActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: fallbackMessage,
      toastId: createToastId(),
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      )
    };
  }

  return {
    status: "error",
    toastId: createToastId(),
    message: error instanceof Error ? error.message : "Settings update failed."
  };
}

function settingsSuccessState(message: string): SettingsActionState {
  return {
    status: "success",
    message,
    toastId: createToastId()
  };
}

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function revalidateSettingsPaths(storeSlug: string) {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/courier");
  revalidatePath("/dashboard/settings/invoice");
  revalidatePath("/dashboard/settings/social");
  revalidatePath("/dashboard/theme");
  revalidatePath("/dashboard/storefront/themes");
  // The internal route on purpose: /s/<slug> is what Next serves, and a
  // storefront hostname is a rewrite onto it. Revalidating the clean
  // address would quietly revalidate nothing.
  revalidatePath(`/s/${storeSlug}`);
  revalidatePath(`/s/${storeSlug}/cart`);
  revalidatePath(`/s/${storeSlug}/checkout`);
  revalidatePath(`/s/${storeSlug}/categories`);
  revalidatePath(`/s/${storeSlug}/products`);
  revalidatePath(`/s/${storeSlug}/search`);
}
