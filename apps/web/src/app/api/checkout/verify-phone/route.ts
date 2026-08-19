import { NextResponse, type NextRequest } from "next/server";
import { readClientIp } from "../../../../lib/request-ip";
import { requestCheckoutPhoneCode } from "../../../../modules/checkout/checkout-verification.service";
import { getStorefrontBySlug } from "../../../../modules/storefront/resolver";
import { otpErrorResponse, readJsonBody } from "../../auth/_otp-response";

/**
 * Sends a shopper the code their cash-on-delivery order will be confirmed with.
 * The code itself is checked during order creation, so nothing here grants any
 * standing permission — this endpoint only puts a message on its way.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as { phone?: unknown; storeSlug?: unknown };
    const store = await getStorefrontBySlug(String(body.storeSlug ?? ""));

    if (!store) {
      return NextResponse.json({ code: "UNKNOWN", error: "Storefront not found." }, { status: 404 });
    }

    const ticket = await requestCheckoutPhoneCode(
      store.id,
      { phone: String(body.phone ?? "") },
      { ipAddress: readClientIp(request.headers) }
    );

    return NextResponse.json(
      {
        ...(ticket.devCode === undefined ? {} : { devCode: ticket.devCode }),
        identifier: ticket.identifier,
        resendAvailableAt: ticket.resendAvailableAt.toISOString()
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return otpErrorResponse(error);
  }
}
