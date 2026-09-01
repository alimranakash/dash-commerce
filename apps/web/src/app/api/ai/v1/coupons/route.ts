import type { NextRequest } from "next/server";
import { createAiCoupon } from "../../../../../modules/ai/ai-actions.service";
import { CouponError } from "../../../../../modules/coupons/coupon.service";
import { AiApiRouteError, parseAiBody, withAiApiRoute } from "../../../../../modules/ai/ai-route";
import { aiCouponCreateBodySchema } from "../../../../../modules/ai/ai.schema";

/**
 * `POST /api/ai/v1/coupons` — create a discount code.
 *
 * Body: `code`, `name`, `discountValue`, and optionally `discountType`
 * (`PERCENTAGE` by default), `description`, `minSubtotal`, `maxSubtotal`,
 * `maxDiscountAmount`, `startsAt`, `expiresAt` (`YYYY-MM-DD`),
 * `usageLimitTotal`, `usageLimitPerCustomer`, `status`.
 *
 * The one **create** on this API, and the reason it is allowed where products
 * and orders are not: a coupon is additive, bounded and expires. A wrong one
 * costs a discount; a wrong product or order corrupts the seller's records.
 *
 * Validation is `createCouponSchema`'s, not this route's — including the
 * cross-field rules (a percentage over 100, a cap on a fixed discount, an end
 * date before the start). A code already in use is the caller's mistake and
 * answers 409, which is the one thing a retry should not repeat verbatim.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A write spends more of the key's allowance than a read. See `AiRouteOptions`. */
const WRITE_COST = 5;

export async function POST(request: NextRequest) {
  return withAiApiRoute(
    request,
    { cost: WRITE_COST, scope: "write:marketing" },
    async (identity, httpRequest) => {
      const body = await parseAiBody(httpRequest, aiCouponCreateBodySchema);

      try {
        return await createAiCoupon({
          actor: {
            keyHint: identity.keyHint,
            keyId: identity.keyId,
            keyName: identity.keyName
          },
          body,
          storeId: identity.storeId
        });
      } catch (error) {
        // `CouponError` is already a sentence written for a seller — a duplicate
        // code, an impossible date window. Anything else stays a 500 and is not
        // described to the caller.
        if (error instanceof CouponError) {
          throw new AiApiRouteError(409, "coupon_rejected", error.message);
        }

        throw error;
      }
    }
  );
}
