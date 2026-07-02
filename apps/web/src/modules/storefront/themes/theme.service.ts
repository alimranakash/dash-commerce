import { prisma } from "@dash/db";
import { ensureDefaultSettingsForStore } from "../../settings/settings.service";
import { defaultStorefrontTheme } from "./default/config";
import { getStorefrontThemeBySlug } from "./registry";
import type {
  StorefrontBranding,
  StorefrontThemeContextValue,
  StorefrontThemeSettings
} from "./types";

const STORE_BG = "#fbfaf7";
const STORE_TEXT = "#171717";

export async function getActiveStorefrontTheme(storeId: string) {
  const settings = await getStorefrontThemeSettings(storeId);
  return getStorefrontThemeBySlug(settings.themeName);
}

export async function getStorefrontThemeSettings(storeId: string) {
  const [store, records] = await Promise.all([
    prisma.store.findUnique({
      where: {
        id: storeId
      },
      include: {
        domains: {
          orderBy: [
            {
              isPrimary: "desc"
            },
            {
              createdAt: "asc"
            }
          ]
        },
        setting: true,
        themeSetting: true
      }
    }),
    ensureDefaultSettingsForStore(storeId)
  ]);

  const storeSetting = store?.setting ?? records.storeSetting;
  const themeSetting = store?.themeSetting ?? records.themeSetting;
  const theme = getStorefrontThemeBySlug(themeSetting.themeName);
  const defaultSettings = theme.defaultSettings;

  return {
    announcementText: themeSetting.announcementText ?? defaultSettings.announcementText,
    advancedSettings: records.themeSetting.advancedSettings ?? defaultSettings.advancedSettings,
    faviconUrl: storeSetting.faviconUrl ?? defaultSettings.faviconUrl,
    featuredSectionTitle: themeSetting.featuredSectionTitle || defaultSettings.featuredSectionTitle,
    heroImageUrl: themeSetting.heroImageUrl ?? defaultSettings.heroImageUrl,
    heroSubtitle: themeSetting.heroSubtitle ?? defaultSettings.heroSubtitle,
    heroTitle: themeSetting.heroTitle || defaultSettings.heroTitle,
    logoUrl: storeSetting.logoUrl ?? defaultSettings.logoUrl,
    primaryColor: safeHexColor(themeSetting.primaryColor, defaultSettings.primaryColor),
    secondaryColor: safeHexColor(themeSetting.secondaryColor, defaultSettings.secondaryColor),
    themeName: themeSetting.themeName || defaultStorefrontTheme.slug
  };
}

export function createStorefrontThemeContext(input: {
  settings: Awaited<ReturnType<typeof getStorefrontThemeSettings>>;
  store: StorefrontThemeContextValue["store"];
}): StorefrontThemeContextValue {
  const theme = getStorefrontThemeBySlug(input.settings.themeName);
  const branding: StorefrontBranding = {
    contactEmail: input.store.setting?.contactEmail ?? null,
    contactPhone: input.store.setting?.contactPhone ?? null,
    logoUrl: input.settings.logoUrl,
    socialLinks: {
      facebookUrl: input.store.setting?.facebookUrl ?? null,
      instagramUrl: input.store.setting?.instagramUrl ?? null,
      whatsappNumber: input.store.setting?.whatsappNumber ?? null
    }
  };
  const settings: StorefrontThemeSettings = {
    announcementText: input.settings.announcementText,
    advancedSettings: input.settings.advancedSettings,
    faviconUrl: input.settings.faviconUrl,
    featuredSectionTitle: input.settings.featuredSectionTitle,
    heroImageUrl: input.settings.heroImageUrl,
    heroSubtitle: input.settings.heroSubtitle,
    heroTitle: input.settings.heroTitle,
    logoUrl: input.settings.logoUrl,
    primaryColor: input.settings.primaryColor,
    secondaryColor: input.settings.secondaryColor
  };

  return {
    branding,
    colors: {
      background: STORE_BG,
      primary: input.settings.primaryColor,
      secondary: input.settings.secondaryColor,
      text: STORE_TEXT
    },
    settings,
    store: input.store,
    theme
  };
}

function safeHexColor(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}
