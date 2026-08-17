import { getModuleSettings, updateVerificationSettings } from "../settings/settings.service";
import { toVerificationStatus } from "./fake-order.types";
import type { StoredVerificationStatus } from "./fake-order.types";

/**
 * The verification gate in front of courier booking.
 *
 * Opt-in per store and off by default, so a store that does not use the
 * Verification Queue books exactly as it did before. When it is on, only a
 * VERIFIED order may be handed to a carrier — a booking is a real parcel and a
 * real cash-on-delivery instruction, so the check happens before anything is
 * reserved or dispatched, and it is expressed as a plain sentence the seller can
 * act on rather than a carrier-shaped error.
 */

export type OrderVerificationSubject = {
  orderNumber: string;
  verificationStatus: StoredVerificationStatus | string;
};

export async function isCourierVerificationRequired(storeId: string) {
  const settings = await getModuleSettings(storeId);

  return settings.verification.blockCourierUntilVerified;
}

export async function setCourierVerificationRequired(storeId: string, required: boolean) {
  await updateVerificationSettings(storeId, { blockCourierUntilVerified: required });
}

/**
 * The reason this order may not be booked, or null when it may.
 *
 * Callers that already know the store policy pass it in, so a bulk run reads the
 * setting once rather than once per order.
 */
export function courierVerificationBlockReason(
  order: OrderVerificationSubject,
  required: boolean
): string | null {
  if (!required) {
    return null;
  }

  const status = toVerificationStatus(String(order.verificationStatus));

  if (status === "VERIFIED") {
    return null;
  }

  if (status === "FAKE") {
    return `Order ${order.orderNumber} was marked fake, so it cannot be sent to a courier. Return it to the normal queue first if that was a mistake.`;
  }

  if (status === "BLOCKED") {
    return `Order ${order.orderNumber} belongs to a blocked customer, so it cannot be sent to a courier. Return it to the normal queue first if that was a mistake.`;
  }

  return `Order ${order.orderNumber} has not been verified yet. Your store requires verification before courier booking — mark it verified in Orders › Verification Queue, then send it again.`;
}

/** Convenience wrapper for the single-order path, which has no policy in hand. */
export async function getCourierVerificationBlockReason(
  storeId: string,
  order: OrderVerificationSubject
) {
  return courierVerificationBlockReason(order, await isCourierVerificationRequired(storeId));
}
