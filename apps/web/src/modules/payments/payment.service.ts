import {
  defaultPaymentMethods,
  ensureDefaultPaymentMethodsRecords,
  getEnabledPaymentMethodsRecord,
  getPaymentMethodsRecord,
  updatePaymentMethodsRecord
} from "./payment.repository";
import {
  paymentSettingsSchema,
  type PaymentMethodTypeValue,
  type PaymentSettingsInput
} from "./payment.schema";

export async function ensureDefaultPaymentMethodsForStore(storeId: string) {
  const existingMethods = await getPaymentMethodsRecord(storeId);

  if (existingMethods.length === Object.keys(defaultPaymentMethods).length) {
    return existingMethods;
  }

  return ensureDefaultPaymentMethodsRecords(storeId);
}

export async function getPaymentMethods(storeId: string) {
  await ensureDefaultPaymentMethodsForStore(storeId);

  return getPaymentMethodsRecord(storeId);
}

export async function getEnabledPaymentMethods(storeId: string) {
  await ensureDefaultPaymentMethodsForStore(storeId);

  return getEnabledPaymentMethodsRecord(storeId);
}

export async function updatePaymentMethods(storeId: string, input: PaymentSettingsInput) {
  const data = paymentSettingsSchema.parse(input);

  return updatePaymentMethodsRecord(storeId, data.methods);
}

export async function getEnabledPaymentMethodForCheckout(
  storeId: string,
  type: PaymentMethodTypeValue
) {
  const methods = await getEnabledPaymentMethods(storeId);
  const method = methods.find((entry) => entry.type === type);

  if (!method) {
    throw new Error("Selected payment method is not available.");
  }

  return method;
}

export function isManualPaymentType(type: PaymentMethodTypeValue) {
  return type === "BKASH_MANUAL" || type === "NAGAD_MANUAL" || type === "ROCKET_MANUAL";
}
