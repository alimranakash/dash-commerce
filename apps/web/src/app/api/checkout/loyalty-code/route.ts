import { after, NextResponse, type NextRequest } from "next/server";
import { readClientIp } from "../../../../lib/request-ip";
import {
  BLOCKED_IP_MESSAGE,
  isIpBlocked
} from "../../../../modules/blocked-ips/blocked-ip.enforcement";
import { responseDevCode } from "../../../../modules/auth/otp/otp-delivery";
import { requestLoyaltyRedemptionCode } from "../../../../modules/loyalty/loyalty.service";
import { getStorefrontBySlug } from "../../../../modules/storefront/resolver";
import { otpErrorResponse, readJsonBody } from "../../auth/_otp-response";

/**
 * Sends the code a shopper proves their number with before spending points.
 *
 * Answers the same whether or not the number holds points here — the service
 * skips the send for a number with nothing to redeem — so this cannot be used
 * to learn who is a member. Nothing here grants anything: the code is checked
 * by `/api/checkout/loyalty-verify`, and the order re-checks everything again.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await readJsonBody(request)) as { phone?: unknown; storeSlug?: unknown };
    const store = await getStorefrontBySlug(String(body.storeSlug ?? ""));

    if (!store) {
      return NextResponse.json(
        { code: "UNKNOWN", error: "Storefront not found." },
        { status: 404 }
      );
    }

    const ipAddress = readClientIp(request.headers);

    // Before the send, for the reason the COD code route gives: every message
    // sent to someone who cannot buy is the seller's SMS credit wasted.
    if (await isIpBlocked(store.id, ipAddress)) {
      return NextResponse.json({ code: "BLOCKED", error: BLOCKED_IP_MESSAGE }, { status: 403 });
    }

    // A member's message goes out after this response, so the reply takes the
    // same time whoever asked; `after` keeps the send tied to this request
    // rather than leaving it floating.
    const ticket = await requestLoyaltyRedemptionCode(
      store.id,
      { phone: String(body.phone ?? "") },
      { ipAddress, schedule: after }
    );
    const devCode = responseDevCode(ticket.devCode);

    return NextResponse.json(
      {
        ...(devCode === undefined ? {} : { devCode }),
        identifier: ticket.identifier,
        resendAvailableAt: ticket.resendAvailableAt.toISOString()
      },
      { status: 201 }
    );
  } catch (error) {
    return otpErrorResponse(error);
  }
}
