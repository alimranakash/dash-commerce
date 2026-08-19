import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isOtpError, otpErrorStatus } from "../../../modules/auth/otp/otp-errors";

/**
 * A body that will not parse is the caller's mistake, not a server fault, so it
 * is handed on as an empty object and left to Zod to reject with a 400 naming
 * the field that is missing.
 */
export async function readJsonBody(request: Request) {
  return (await request.json().catch(() => ({}))) as unknown;
}

/**
 * One shape for every failure both OTP routes can produce, so the sign-up form
 * has a single `code` to branch on and never has to read a status code.
 */
export function otpErrorResponse(error: unknown) {
  if (isOtpError(error)) {
    return NextResponse.json(
      {
        code: error.code,
        error: error.message,
        ...(error.attemptsRemaining === undefined
          ? {}
          : { attemptsRemaining: error.attemptsRemaining }),
        ...(error.retryAfterSeconds === undefined
          ? {}
          : { retryAfterSeconds: error.retryAfterSeconds })
      },
      {
        status: otpErrorStatus(error.code),
        ...(error.retryAfterSeconds === undefined
          ? {}
          : { headers: { "Retry-After": String(error.retryAfterSeconds) } })
      }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        code: "INVALID_INPUT",
        error: error.issues[0]?.message ?? "Check the details you entered."
      },
      {
        status: 400
      }
    );
  }

  // Anything unrecognised is ours, not the visitor's — say so without leaking
  // what broke, and leave the detail in the server log.
  console.error("OTP request failed", error);

  return NextResponse.json(
    {
      code: "UNKNOWN",
      error: "Something went wrong sending your code. Try again."
    },
    {
      status: 500
    }
  );
}
