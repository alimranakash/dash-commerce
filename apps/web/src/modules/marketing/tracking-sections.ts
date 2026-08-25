import type { MarketingSettingsFormInput, MarketingSettingsView } from "./marketing.schema";

/**
 * The Analytics & Tracking pages, and which settings each one owns.
 *
 * Splitting one long form into a page per platform means every save now submits
 * a fraction of the record. `updateMarketingSettings` writes every column it is
 * given, so a page that posted only its own fields would blank all the others —
 * saving a TikTok pixel would silently delete the store's GA4 ID.
 *
 * This map is what stops that: the action rebuilds the full settings object from
 * what is stored and overlays only the fields the submitting section owns.
 * Adding a field to a page means adding it here too, or it will not be saved.
 */
export const TRACKING_SECTIONS = {
  custom: {
    fields: ["customEnabled", "customHeaderCode", "customBodyCode", "customFooterCode"],
    label: "Custom Tracking",
    path: "custom"
  },
  "google-ads": {
    fields: ["googleAdsConversionId"],
    label: "Google Ads",
    path: "google-ads"
  },
  "google-analytics": {
    fields: ["ga4MeasurementId", "googleSiteVerification"],
    label: "Google Analytics",
    path: "google-analytics"
  },
  gtm: {
    fields: ["gtmContainerId"],
    label: "Google Tag Manager",
    path: "gtm"
  },
  "meta-pixel": {
    fields: ["metaPixelId", "metaDomainVerification"],
    label: "Meta Pixel",
    path: "meta-pixel"
  },
  "server-side": {
    fields: [
      "ga4MpEnabled",
      "ga4ApiSecret",
      "ga4ApiSecretCleared",
      "metaCapiEnabled",
      "metaCapiToken",
      "metaCapiTokenCleared"
    ],
    label: "Server-Side Tracking",
    path: "server-side"
  },
  "tiktok-pixel": {
    fields: ["tiktokPixelId"],
    label: "TikTok Pixel",
    path: "tiktok-pixel"
  }
} as const satisfies Record<
  string,
  { fields: readonly (keyof MarketingSettingsFormInput)[]; label: string; path: string }
>;

export type TrackingSectionKey = keyof typeof TRACKING_SECTIONS;

export const TRACKING_SECTION_KEYS = Object.keys(TRACKING_SECTIONS) as TrackingSectionKey[];

export function isTrackingSectionKey(value: string): value is TrackingSectionKey {
  return value in TRACKING_SECTIONS;
}

/**
 * The stored settings, shaped as form input.
 *
 * The two secrets come back blank on purpose. The view never carries them, and
 * `updateMarketingSettings` already reads blank as "keep what is stored" — so a
 * page that has nothing to do with the Conversions API cannot accidentally
 * rotate or wipe its token just by being saved.
 */
export function trackingInputFromView(view: MarketingSettingsView): MarketingSettingsFormInput {
  return {
    customBodyCode: view.customBodyCode,
    customEnabled: view.customEnabled,
    customFooterCode: view.customFooterCode,
    customHeaderCode: view.customHeaderCode,
    ga4ApiSecret: "",
    ga4ApiSecretCleared: false,
    ga4MeasurementId: view.ga4MeasurementId,
    ga4MpEnabled: view.ga4MpEnabled,
    googleAdsConversionId: view.googleAdsConversionId,
    googleSiteVerification: view.googleSiteVerification,
    gtmContainerId: view.gtmContainerId,
    metaCapiEnabled: view.metaCapiEnabled,
    metaCapiToken: "",
    metaCapiTokenCleared: false,
    metaDomainVerification: view.metaDomainVerification,
    metaPixelId: view.metaPixelId,
    tiktokPixelId: view.tiktokPixelId
  };
}

/** Which of a section's settings are filled in, for the overview's status column. */
export function isTrackingSectionConfigured(
  section: TrackingSectionKey,
  view: MarketingSettingsView
) {
  switch (section) {
    case "custom":
      return view.customEnabled && Boolean(view.customHeaderCode || view.customBodyCode || view.customFooterCode);
    case "google-ads":
      return Boolean(view.googleAdsConversionId);
    case "google-analytics":
      return Boolean(view.ga4MeasurementId);
    case "gtm":
      return Boolean(view.gtmContainerId);
    case "meta-pixel":
      return Boolean(view.metaPixelId);
    case "server-side":
      return view.ga4MpEnabled || view.metaCapiEnabled;
    case "tiktok-pixel":
      return Boolean(view.tiktokPixelId);
  }
}
