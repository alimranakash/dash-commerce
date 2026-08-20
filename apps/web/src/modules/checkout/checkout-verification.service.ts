import { getSmsAllowance } from "../billing/subscription-limits";
import { normalizeBangladeshPhone } from "../courier/courier-phone";
import { OtpError } from "../auth/otp/otp-errors";
import { requestOtpChallenge, verifyOtpChallenge } from "../auth/otp/otp.service";
import { getModuleSettings, updateVerificationSettings } from "../settings/settings.service";

/**
 * Confirming a shopper's number before a cash-on-delivery order is accepted.
 *
 * Only COD, and only when the seller asks for it. A prepaid order has already
 * cost the buyer money, so the number behind it is not the thing at risk — but a
 * COD parcel is dispatched on nothing but a phone number, and a wrong one is a
 * courier trip the seller pays for. That is the whole reason this exists, and
 * the reason it is off by default: it adds friction to every order, and only a
 * store with a fake-order problem should be paying that.
 *
 * The code is checked inside order creation rather than exchanged for a token
 * beforehand, so there is no state a client could forge or replay — an order
 * either arrives with a working code or is not created.
 */

/**
 * Whether a shopper will be asked for a code — the setting *and* the store still
 * having messages left to send.
 *
 * A store that has spent its monthly allowance stops verifying rather than
 * stops selling. Losing an order costs a seller far more than losing one
 * verification, and a shopper cannot be shown a code field for a message that
 * will never arrive. The seller is told loudly instead: the blocked sends are
 * counted in the admin messaging card, and the send itself logs a warning.
 */
export async function isCheckoutPhoneOtpRequired(storeId: string) {
  const settings = await getModuleSettings(storeId);

  if (!settings.verification.requirePhoneOtpForCod) {
    return false;
  }

  const allowance = await getSmsAllowance(storeId);

  return allowance.remaining === null || allowance.remaining > 0;
}

/** The seller-facing switch, which stays on even when the allowance runs out. */
export async function isCheckoutPhoneOtpEnabled(storeId: string) {
  const settings = await getModuleSettings(storeId);

  return settings.verification.requirePhoneOtpForCod;
}

export async function setCheckoutPhoneOtpRequired(storeId: string, required: boolean) {
  await updateVerificationSettings(storeId, { requirePhoneOtpForCod: required });
}

export async function requestCheckoutPhoneCode(
  storeId: string,
  input: { phone: string },
  context: { ipAddress: string | null }
) {
  if (!(await isCheckoutPhoneOtpRequired(storeId))) {
    throw new OtpError("INVALID_IDENTIFIER", "This store does not verify numbers at checkout.");
  }

  const phone = normalizeBangladeshPhone(input.phone);

  if (!phone) {
    throw new OtpError("INVALID_IDENTIFIER", "Enter a valid Bangladesh mobile number.");
  }

  return requestOtpChallenge({
    identifier: { channel: "SMS", phone },
    ipAddress: context.ipAddress,
    purpose: "CHECKOUT",
    // The only code sent on a seller's behalf, and so the only one that comes
    // out of their plan rather than the platform's own cost.
    storeId
  });
}

/**
 * Called from inside order creation, before anything is reserved. Silent for a
 * store that does not require it and for every non-COD method.
 */
export async function assertCheckoutPhoneVerified(
  storeId: string,
  input: { code: string | undefined; paymentMethod: string; phone: string }
) {
  if (input.paymentMethod !== "COD" || !(await isCheckoutPhoneOtpRequired(storeId))) {
    return;
  }

  const phone = normalizeBangladeshPhone(input.phone);

  if (!phone) {
    throw new Error("Enter a valid Bangladesh mobile number so we can confirm your order.");
  }

  if (!input.code) {
    throw new Error("Enter the code we sent to your mobile number to confirm this order.");
  }

  try {
    await verifyOtpChallenge({ code: input.code, identifier: { channel: "SMS", phone }, purpose: "CHECKOUT" });
  } catch (error) {
    // Checkout surfaces failures as a sentence on the page, so the OTP layer's
    // own wording is passed through rather than replaced with something vaguer.
    throw new Error(error instanceof Error ? error.message : "That code did not work.", {
      cause: error
    });
  }
}
