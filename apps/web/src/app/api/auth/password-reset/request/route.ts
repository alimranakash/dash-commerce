import { NextResponse, type NextRequest } from "next/server";
import { readClientIp } from "../../../../../lib/request-ip";
import { responseDevCode } from "../../../../../modules/auth/otp/otp-delivery";
import { requestPasswordResetCode } from "../../../../../modules/auth/password-reset.service";
import { otpErrorResponse, readJsonBody } from "../../_otp-response";

/**
 * Sends a reset code. Answers the same whether or not the handle belongs to an
 * account — this endpoint must not become a way to test which numbers are
 * registered.
 */
export async function POST(request: NextRequest) {
  try {
    const ticket = await requestPasswordResetCode(await readJsonBody(request), {
      ipAddress: readClientIp(request.headers)
    });
    const devCode = responseDevCode(ticket.devCode);

    return NextResponse.json(
      {
        channel: ticket.channel,
        ...(devCode === undefined ? {} : { devCode }),
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
