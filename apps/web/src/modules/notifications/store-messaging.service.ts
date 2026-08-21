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
 * The master switch sits above every use on purpose. A seller who wants to stop
 * all texting for a day should not have to remember which individual toggles
 * they had on.
 */

export type StoreMessagingView = {
  checkoutOtpEnabled: boolean;
  orderConfirmEnabled: boolean;
  orderCustomEnabled: boolean;
  /** Empty rather than null, because this is what a form field is populated with. */
  orderCustomMessage: string;
  smsEnabled: boolean;
};

export async function getStoreMessagingView(storeId: string): Promise<StoreMessagingView> {
  const record = await prisma.storeMessagingSetting.findUnique({ where: { storeId } });

  return {
    checkoutOtpEnabled: record?.checkoutOtpEnabled ?? (await legacyCheckoutOtpFlag(storeId)),
    orderConfirmEnabled: record?.orderConfirmEnabled ?? false,
    orderCustomEnabled: record?.orderCustomEnabled ?? false,
    orderCustomMessage: record?.orderCustomMessage ?? "",
    smsEnabled: record?.smsEnabled ?? false
  };
}

export async function saveStoreMessagingSettings(
  storeId: string,
  input: {
    checkoutOtpEnabled: boolean;
    orderConfirmEnabled: boolean;
    orderCustomEnabled: boolean;
    orderCustomMessage: string | null;
    smsEnabled: boolean;
  }
) {
  return prisma.storeMessagingSetting.upsert({
    create: { ...input, storeId },
    update: input,
    where: { storeId }
  });
}

/**
 * The seller's own order text, or null when nothing should be sent.
 *
 * Blank copy counts as nothing to send: a seller who ticks the box and saves
 * before writing anything gets silence, not an empty text on every order.
 */
export async function getStoreCustomOrderSms(storeId: string) {
  const record = await prisma.storeMessagingSetting.findUnique({
    select: { orderCustomEnabled: true, orderCustomMessage: true, smsEnabled: true },
    where: { storeId }
  });

  if (!record?.smsEnabled || !record.orderCustomEnabled) {
    return null;
  }

  return record.orderCustomMessage?.trim() || null;
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
