import { NextResponse, type NextRequest } from "next/server";
import { LoyaltyError } from "../../../../modules/loyalty/loyalty.rules";
import { verifyLoyaltyRedemptionCode } from "../../../../modules/loyalty/loyalty.service";
import { getStorefrontBySlug } from "../../../../modules/storefront/resolver";
import { otpErrorResponse, readJsonBody } from "../../auth/_otp-response";

/**
 * Checks a shopper's redemption code and, only then, tells them what they
 * hold. The reply is the balance, the store's redemption rules and a token
 * proving the number was verified; it is never a discount, which the order
 * works out for itself when it is placed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as {
      code?: unknown;
      phone?: unknown;
      storeSlug?: unknown;
      submissionId?: unknown;
    };
    const store = await getStorefrontBySlug(String(body.storeSlug ?? ""));

    if (!store) {
      return NextResponse.json(
        { code: "UNKNOWN", error: "Storefront not found." },
        { status: 404 }
      );
    }

    const verified = await verifyLoyaltyRedemptionCode(store.id, {
      code: String(body.code ?? "").trim(),
      phone: String(body.phone ?? ""),
      submissionId: String(body.submissionId ?? "")
    });

    return NextResponse.json(verified);
  } catch (error) {
    // A wrong or expired code is the OTP layer's to describe; a number with no
    // points here, or a suspended one, is the programme's.
    if (error instanceof LoyaltyError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: 422 });
    }

    return otpErrorResponse(error);
  }
}
