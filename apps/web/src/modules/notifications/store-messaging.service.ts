import { prisma } from "@dash/db";
import { getModuleSettings } from "../settings/settings.service";

/**
 * When a store is allowed to text its customers.
 *
 * There is no per-store gateway and no per-store key: every message goes out
 * through the platform's one SMS account, and how many a store may send is set
 * by its plan. A seller decides *when* messages are sent — never *how many*, and
 * never *through what*.
 *
 * The master switch sits above both uses on purpose. A seller who wants to stop
 * all texting for a day should not have to remember which individual toggles
 * they had on.
 */

export type StoreMessagingView = {
  checkoutOtpEnabled: boolean;
  orderConfirmEnabled: boolean;
  smsEnabled: boolean;
};

export async function getStoreMessagingView(storeId: string): Promise<StoreMessagingView> {
  const record = await prisma.storeMessagingSetting.findUnique({ where: { storeId } });

  return {
    checkoutOtpEnabled: record?.checkoutOtpEnabled ?? (await legacyCheckoutOtpFlag(storeId)),
    orderConfirmEnabled: record?.orderConfirmEnabled ?? false,
    smsEnabled: record?.smsEnabled ?? false
  };
}

export async function saveStoreMessagingSettings(
  storeId: string,
  input: { checkoutOtpEnabled: boolean; orderConfirmEnabled: boolean; smsEnabled: boolean }
) {
  return prisma.storeMessagingSetting.upsert({
    create: { ...input, storeId },
    update: input,
    where: { storeId }
  });
}

export async function isStoreOrderConfirmSmsEnabled(storeId: string) {
  const record = await prisma.storeMessagingSetting.findUnique({
    select: { orderConfirmEnabled: true, smsEnabled: true },
    where: { storeId }
  });

  return Boolean(record?.smsEnabled && record.orderConfirmEnabled);
}

export async function isStoreCheckoutOtpEnabled(storeId: string) {
  const record = await prisma.storeMessagingSetting.findUnique({
    select: { checkoutOtpEnabled: true, smsEnabled: true },
    where: { storeId }
  });

  return Boolean(record?.smsEnabled && record.checkoutOtpEnabled);
}

/**
 * The checkout-OTP switch used to live in `moduleSettings.verification`. A store
 * that turned it on there keeps it when this row is first written, rather than
 * silently reverting to off.
 */
async function legacyCheckoutOtpFlag(storeId: string) {
  const settings = await getModuleSettings(storeId).catch(() => null);

  return settings?.verification.requirePhoneOtpForCod ?? false;
}
