import { NextResponse, type NextRequest } from "next/server";
import { readClientIp } from "../../../../../lib/request-ip";
import { requestRegistrationCode } from "../../../../../modules/auth/registration.service";
import { otpErrorResponse, readJsonBody } from "../../_otp-response";

/**
 * Starts a sign-up: takes the name, handle and password, and sends a code to
 * whichever of email or SMS the handle implies. Nothing is created in `User`
 * here — the draft rides along on the challenge until the code is confirmed.
 */
export async function POST(request: NextRequest) {
  try {
    const ticket = await requestRegistrationCode(await readJsonBody(request), {
      ipAddress: readClientIp(request.headers)
    });

    return NextResponse.json(
      {
        channel: ticket.channel,
        ...(ticket.devCode === undefined ? {} : { devCode: ticket.devCode }),
        expiresAt: ticket.expiresAt.toISOString(),
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
