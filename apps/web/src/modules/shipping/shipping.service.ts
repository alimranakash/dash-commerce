import {
  ensureDefaultShippingRecords,
  getEnabledShippingRateRecord,
  getEnabledShippingRatesRecord,
  getShippingZonesRecord,
  updateShippingSettingsRecord
} from "./shipping.repository";
import { shippingSettingsSchema, type ShippingSettingsInput } from "./shipping.schema";

export async function ensureDefaultShippingForStore(storeId: string) {
  return ensureDefaultShippingRecords(storeId);
}

export async function getShippingSettings(storeId: string) {
  await ensureDefaultShippingForStore(storeId);

  return getShippingZonesRecord(storeId);
}

export async function getEnabledShippingRates(storeId: string) {
  await ensureDefaultShippingForStore(storeId);

  return getEnabledShippingRatesRecord(storeId);
}

export async function getEnabledShippingRateForCheckout(storeId: string, rateId: string) {
  await ensureDefaultShippingForStore(storeId);

  const rate = await getEnabledShippingRateRecord(storeId, rateId);

  if (!rate) {
    throw new Error("Choose an available shipping method.");
  }

  return rate;
}

export async function updateShippingSettings(storeId: string, input: ShippingSettingsInput) {
  const data = shippingSettingsSchema.parse(input);
  const rates = data.rates.map((rate) => {
    if (!rate.id) {
      throw new Error("One or more shipping rates could not be found.");
    }

    return {
      ...rate,
      id: rate.id
    };
  });

  return updateShippingSettingsRecord(storeId, {
    deleteRateIds: data.deleteRateIds,
    ...(data.newRate ? { newRate: data.newRate } : {}),
    rates,
    zones: data.zones
  });
}
