import {
  ensureDefaultSettingsRecords,
  getStoreSettingsRecord,
  getThemeSettingsRecord,
  updateStoreSettingsRecord,
  updateThemeSettingsRecord
} from "./settings.repository";
import {
  storeSettingsSchema,
  themeSettingsSchema,
  type StoreSettingsInput,
  type ThemeSettingsInput
} from "./settings.schema";

export async function ensureDefaultSettingsForStore(storeId: string) {
  return ensureDefaultSettingsRecords(storeId);
}

export async function getStoreSettings(storeId: string) {
  const settings = await getStoreSettingsRecord(storeId);

  if (settings) {
    return settings;
  }

  return (await ensureDefaultSettingsRecords(storeId)).storeSetting;
}

export async function getThemeSettings(storeId: string) {
  const settings = await getThemeSettingsRecord(storeId);

  if (settings) {
    return settings;
  }

  return (await ensureDefaultSettingsRecords(storeId)).themeSetting;
}

export async function updateStoreSettings(storeId: string, input: StoreSettingsInput) {
  return updateStoreSettingsRecord(storeId, storeSettingsSchema.parse(input));
}

export async function updateThemeSettings(storeId: string, input: ThemeSettingsInput) {
  return updateThemeSettingsRecord(storeId, themeSettingsSchema.parse(input));
}
