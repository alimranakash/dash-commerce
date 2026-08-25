import { NextResponse, type NextRequest } from "next/server";
import { readClientIp } from "../../../../lib/request-ip";
import {
  BLOCKED_IP_MESSAGE,
  isIpBlocked
} from "../../../../modules/blocked-ips/blocked-ip.enforcement";
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

    const ipAddress = readClientIp(request.headers);

    // Checked before the send, not only at order placement: the order would be
    // refused anyway, and every code sent in between is the seller's SMS credit
    // spent on somebody who cannot buy anything.
    if (await isIpBlocked(store.id, ipAddress)) {
      return NextResponse.json(
        { code: "BLOCKED", error: BLOCKED_IP_MESSAGE },
        { status: 403 }
      );
    }

    const ticket = await requestCheckoutPhoneCode(
      store.id,
      { phone: String(body.phone ?? "") },
      { ipAddress }
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
