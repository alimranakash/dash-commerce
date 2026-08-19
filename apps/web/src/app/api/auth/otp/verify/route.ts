import { NextResponse } from "next/server";
import { verifyRegistrationCode } from "../../../../../modules/auth/registration.service";
import { otpErrorResponse, readJsonBody } from "../../_otp-response";

/**
 * Confirms the code and, only then, creates the account. The caller signs in
 * afterwards with the same credentials it just registered.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRegistrationCode(await readJsonBody(request));

    return NextResponse.json(
      {
        user
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return otpErrorResponse(error);
  }
}
