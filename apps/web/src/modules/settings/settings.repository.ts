import { prisma } from "@dash/db";
import type { StoreSettingsInput, ThemeSettingsInput } from "./settings.schema";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings,
  type StorefrontAdvancedSettings
} from "../storefront/customization";

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
  const record = await prisma.themeSetting.findUnique({
    where: {
      storeId
    }
  });

  if (!record) {
    return null;
  }

  return {
    ...record,
    advancedSettings: await getThemeAdvancedSettings(storeId)
  };
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
    themeSetting: {
      ...themeSetting,
      advancedSettings: await getThemeAdvancedSettings(storeId)
    }
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
  const themeSetting = await prisma.themeSetting.upsert({
    where: {
      storeId
    },
    update: nullableThemeData(data),
    create: {
      storeId,
      ...nullableThemeData(data)
    }
  });

  const advancedSettings = data.advancedSettings
    ? normalizeAdvancedSettings(data.advancedSettings)
    : DEFAULT_STOREFRONT_ADVANCED_SETTINGS;

  await updateThemeAdvancedSettings(storeId, advancedSettings);

  return {
    ...themeSetting,
    advancedSettings
  };
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

async function ensureThemeAdvancedSettingsColumn() {
  const tableName = await getThemeSettingsTableName();

  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS "advancedSettings" JSONB`
  );
}

async function getThemeAdvancedSettings(storeId: string) {
  await ensureThemeAdvancedSettingsColumn();
  const tableName = await getThemeSettingsTableName();

  const rows = await prisma.$queryRawUnsafe<Array<{ advancedSettings: unknown }>>(
    `SELECT "advancedSettings" FROM ${tableName} WHERE "storeId" = $1 LIMIT 1`,
    storeId
  );

  return normalizeAdvancedSettings(rows[0]?.advancedSettings);
}

async function updateThemeAdvancedSettings(storeId: string, settings: StorefrontAdvancedSettings) {
  await ensureThemeAdvancedSettingsColumn();
  const tableName = await getThemeSettingsTableName();

  await prisma.$executeRawUnsafe(
    `UPDATE ${tableName} SET "advancedSettings" = $1::jsonb WHERE "storeId" = $2`,
    JSON.stringify(settings),
    storeId
  );
}

async function getThemeSettingsTableName() {
  const rows = await prisma.$queryRawUnsafe<Array<{ table_schema: string; table_name: string }>>(
    'SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = $1 ORDER BY CASE WHEN table_schema = current_schema() THEN 0 ELSE 1 END LIMIT 1',
    "ThemeSetting"
  );
  const table = rows[0];

  if (!table) {
    return '"ThemeSetting"';
  }

  return `"${table.table_schema.replace(/"/g, '""')}"."${table.table_name.replace(/"/g, '""')}"`;
}
