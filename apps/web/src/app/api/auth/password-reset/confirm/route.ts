import { NextResponse } from "next/server";
import { confirmPasswordReset } from "../../../../../modules/auth/password-reset.service";
import { otpErrorResponse, readJsonBody } from "../../_otp-response";

/** Confirms the code and replaces the password in one step. */
export async function POST(request: Request) {
  try {
    await confirmPasswordReset(await readJsonBody(request));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return otpErrorResponse(error);
  }
}
