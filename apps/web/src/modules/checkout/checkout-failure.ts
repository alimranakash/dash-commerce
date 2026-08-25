import { ZodError } from "zod";
import { BlockedIpError } from "../blocked-ips/blocked-ip.enforcement";
import { OtpError } from "../auth/otp/otp-errors";
import { SubscriptionLockedError } from "../billing/free-trial";
import type { IncompleteOrderFailureCode } from "../abandoned-carts/abandoned-cart.types";

/**
 * A checkout refusal the seller should be able to read a reason for.
 *
 * The code is what the incomplete-orders list groups and labels by; the message
 * is still the shopper's, and is what the storefront shows them. Everything
 * checkout throws on purpose is one of these, so the classification below is a
 * lookup rather than a guess for every case that matters.
 *
 * The code union lives in the abandoned-carts module because that is where it
 * is stored and rendered, which is the direction these two already depend in.
 */
export class CheckoutError extends Error {
  readonly code: IncompleteOrderFailureCode;

  constructor(code: IncompleteOrderFailureCode, message: string) {
    super(message);

    this.code = code;
    this.name = "CheckoutError";
  }
}

export type CheckoutFailure = {
  code: IncompleteOrderFailureCode;
  reason: string;
};

/**
 * Turns whatever stopped a checkout into something a seller can act on.
 *
 * The typed errors are exact. Below them is a small set of message patterns,
 * for the guards that live in other modules and raise plain errors — a
 * best-effort label on top of the message, which is stored either way, so an
 * unrecognised failure still reads as the sentence the shopper was shown
 * rather than as nothing at all.
 */
export function classifyCheckoutFailure(error: unknown): CheckoutFailure {
  if (error instanceof CheckoutError) {
    return { code: error.code, reason: error.message };
  }

  if (error instanceof BlockedIpError) {
    return { code: "BLOCKED_IP", reason: error.message };
  }

  if (error instanceof SubscriptionLockedError) {
    return { code: "STORE_LOCKED", reason: error.message };
  }

  if (error instanceof OtpError) {
    return { code: "PHONE_VERIFICATION", reason: error.message };
  }

  if (error instanceof ZodError) {
    return {
      code: "VALIDATION",
      reason: error.issues[0]?.message ?? "The checkout form was incomplete."
    };
  }

  const reason = error instanceof Error ? error.message : "Checkout failed.";

  return { code: guessCode(reason), reason };
}

function guessCode(reason: string): IncompleteOrderFailureCode {
  if (/stock|no longer available|not available/i.test(reason)) {
    return "OUT_OF_STOCK";
  }

  return "UNKNOWN";
}
