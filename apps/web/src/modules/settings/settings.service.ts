import {
  ensureDefaultSettingsRecords,
  getModuleSettingsRecord,
  getStoreSettingsRecord,
  getThemeSettingsRecord,
  updateModuleSettingsRecord,
  updateStoreSettingsRecord,
  updateThemeSettingsRecord
} from "./settings.repository";
import {
  courierSettingsSchema,
  invoiceSettingsSchema,
  marketingSettingsSchema,
  socialLoginSettingsSchema,
  socialProfileLinksSchema,
  storeSettingsSchema,
  themeSettingsSchema,
  type CourierSettingsInput,
  type InvoiceSettingsInput,
  type MarketingSettingsInput,
  type SocialLoginSettingsInput,
  type SocialProfileLinksInput,
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

export async function getModuleSettings(storeId: string) {
  return getModuleSettingsRecord(storeId);
}

export async function updateCourierSettings(storeId: string, input: CourierSettingsInput) {
  const current = await getModuleSettingsRecord(storeId);

  return updateModuleSettingsRecord(storeId, {
    ...current,
    courier: courierSettingsSchema.parse(input)
  });
}

export async function updateInvoiceSettings(storeId: string, input: InvoiceSettingsInput) {
  const current = await getModuleSettingsRecord(storeId);

  return updateModuleSettingsRecord(storeId, {
    ...current,
    invoice: invoiceSettingsSchema.parse(input)
  });
}

export async function updateMarketingSettings(storeId: string, input: MarketingSettingsInput) {
  const current = await getModuleSettingsRecord(storeId);

  return updateModuleSettingsRecord(storeId, {
    ...current,
    marketing: marketingSettingsSchema.parse(input)
  });
}

export async function updateSocialLoginSettings(storeId: string, input: SocialLoginSettingsInput) {
  const current = await getModuleSettingsRecord(storeId);

  return updateModuleSettingsRecord(storeId, {
    ...current,
    socialLogin: socialLoginSettingsSchema.parse(input)
  });
}

export async function updateSocialProfileLinks(storeId: string, input: SocialProfileLinksInput) {
  const current = await getModuleSettingsRecord(storeId);

  return updateModuleSettingsRecord(storeId, {
    ...current,
    socialProfiles: socialProfileLinksSchema.parse(input)
  });
}
