import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proof that a shopper verified their number for redemption.
 *
 * The SMS code is spent the moment it is checked, so the checkout cannot ask
 * for it again when the order is placed. Instead the verify step hands back
 * this token: the store, the member, the phone key and the checkout page load
 * it was issued for, and when it stops being good, signed with the server's
 * secret. It names no balance and no discount — the order re-reads both
 * inside its own transaction — so the most a copied token can do is pay, once,
 * for the one order on the page whose shopper proved they own that number.
 *
 * Signed under its own domain string, so a cart cookie's signature (same
 * secret, same algorithm) can never be presented as one of these.
 */

const TOKEN_TTL_MS = 30 * 60 * 1000;
const DOMAIN = "storeim-loyalty-redemption:v1";

export type RedemptionClaim = {
  expiresAt: number;
  memberId: string;
  phoneKey: string;
  storeId: string;
  /**
   * The checkout page load it was issued for. Each page load posts its own
   * submission id and an order is unique on it, so a token can pay for one
   * order only: a second order is a second page load and needs a fresh code,
   * and the same page resubmitted lands on the order it already placed.
   */
  submissionId: string;
};

export function signRedemptionToken(
  claim: Omit<RedemptionClaim, "expiresAt">,
  now = Date.now(),
  secret = redemptionSecret()
) {
  const payload = Buffer.from(
    JSON.stringify({
      e: now + TOKEN_TTL_MS,
      m: claim.memberId,
      n: claim.submissionId,
      p: claim.phoneKey,
      s: claim.storeId
    })
  ).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

/** The claim, or null for anything forged, malformed or expired. */
export function readRedemptionToken(
  token: string | null | undefined,
  now = Date.now(),
  secret = redemptionSecret()
): RedemptionClaim | null {
  const [payload, signature, extra] = String(token ?? "").split(".");

  if (!payload || !signature || extra !== undefined) {
    return null;
  }

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;

    if (
      typeof value.e !== "number" ||
      typeof value.m !== "string" ||
      typeof value.n !== "string" ||
      !value.n ||
      typeof value.p !== "string" ||
      typeof value.s !== "string" ||
      value.e <= now
    ) {
      return null;
    }

    return {
      expiresAt: value.e,
      memberId: value.m,
      phoneKey: value.p,
      storeId: value.s,
      submissionId: value.n
    };
  } catch {
    return null;
  }
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`${DOMAIN}.${payload}`).digest("base64url");
}

function redemptionSecret() {
  return process.env.NEXTAUTH_SECRET ?? "dash-commerce-local-loyalty-secret";
}
