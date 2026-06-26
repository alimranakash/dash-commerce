import { prisma } from "@dash/db";
import type { StoreSettingsInput, ThemeSettingsInput } from "./settings.schema";

export const DEFAULT_PRIMARY_COLOR = "#135d66";
export const DEFAULT_THEME_NAME = "Theme v1";
export const DEFAULT_HERO_TITLE = "Discover what is new";
export const DEFAULT_FEATURED_TITLE = "Products worth a closer look";

export async function getStoreSettingsRecord(storeId: string) {
  return prisma.storeSetting.findUnique({
    where: {
      storeId
    }
  });
}

export async function getThemeSettingsRecord(storeId: string) {
  return prisma.themeSetting.findUnique({
    where: {
      storeId
    }
  });
}

export async function ensureDefaultSettingsRecords(storeId: string) {
  const [storeSetting, themeSetting] = await Promise.all([
    prisma.storeSetting.upsert({
      where: {
        storeId
      },
      update: {},
      create: {
        storeId
      }
    }),
    prisma.themeSetting.upsert({
      where: {
        storeId
      },
      update: {},
      create: defaultThemeCreateData(storeId)
    })
  ]);

  return {
    storeSetting,
    themeSetting
  };
}

export async function updateStoreSettingsRecord(storeId: string, data: StoreSettingsInput) {
  return prisma.storeSetting.upsert({
    where: {
      storeId
    },
    update: nullableSettingsData(data),
    create: {
      storeId,
      ...nullableSettingsData(data)
    }
  });
}

export async function updateThemeSettingsRecord(storeId: string, data: ThemeSettingsInput) {
  return prisma.themeSetting.upsert({
    where: {
      storeId
    },
    update: nullableThemeData(data),
    create: {
      storeId,
      ...nullableThemeData(data)
    }
  });
}

export function defaultThemeCreateData(storeId: string) {
  return {
    storeId,
    themeName: DEFAULT_THEME_NAME,
    primaryColor: DEFAULT_PRIMARY_COLOR,
    heroTitle: DEFAULT_HERO_TITLE,
    featuredSectionTitle: DEFAULT_FEATURED_TITLE
  };
}

function nullableSettingsData(data: StoreSettingsInput) {
  return {
    logoUrl: data.logoUrl ?? null,
    faviconUrl: data.faviconUrl ?? null,
    tagline: data.tagline ?? null,
    contactEmail: data.contactEmail ?? null,
    contactPhone: data.contactPhone ?? null,
    supportPhone: data.supportPhone ?? null,
    businessAddress: data.businessAddress ?? null,
    facebookUrl: data.facebookUrl ?? null,
    instagramUrl: data.instagramUrl ?? null,
    whatsappNumber: data.whatsappNumber ?? null
  };
}

function nullableThemeData(data: ThemeSettingsInput) {
  return {
    themeName: DEFAULT_THEME_NAME,
    primaryColor: data.primaryColor,
    secondaryColor: data.secondaryColor ?? null,
    heroTitle: data.heroTitle,
    heroSubtitle: data.heroSubtitle ?? null,
    heroImageUrl: data.heroImageUrl ?? null,
    announcementText: data.announcementText ?? null,
    featuredSectionTitle: data.featuredSectionTitle
  };
}
