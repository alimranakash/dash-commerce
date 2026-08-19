import { hash } from "bcryptjs";
import { findUserByIdentifier, updateUserPasswordHash } from "./account.repository";
import { parseAccountIdentifier, type AccountIdentifier } from "./identifier";
import { OtpError } from "./otp/otp-errors";
import { confirmPasswordResetSchema, requestPasswordResetSchema } from "./otp/otp.schema";
import { requestOtpChallenge, verifyOtpChallenge } from "./otp/otp.service";

/**
 * Resetting a forgotten password, without saying who has an account.
 *
 * Registration cannot avoid admitting a handle is taken — that is the whole
 * answer it owes. Reset can and must: anyone can type any number into it, so
 * every response is identical whether or not the account exists. A challenge is
 * created either way, and only the sending is skipped, so the two paths cost the
 * same time and consume the same allowance.
 */

export async function requestPasswordResetCode(
  input: unknown,
  context: { ipAddress: string | null }
) {
  const data = requestPasswordResetSchema.parse(input);
  const identifier = requireIdentifier(data.identifier);
  const user = await findUserByIdentifier(identifier);

  return requestOtpChallenge({
    identifier,
    ipAddress: context.ipAddress,
    purpose: "PASSWORD_RESET",
    suppressDelivery: user === null
  });
}

export async function confirmPasswordReset(input: unknown) {
  const data = confirmPasswordResetSchema.parse(input);
  const identifier = requireIdentifier(data.identifier);

  // Checked before the account is looked up, so a wrong code always costs an
  // attempt — otherwise an unknown handle would answer faster than a known one.
  await verifyOtpChallenge({ code: data.code, identifier, purpose: "PASSWORD_RESET" });

  const user = await findUserByIdentifier(identifier);

  if (!user) {
    throw new OtpError("INVALID_CODE", "That code is not right.");
  }

  await updateUserPasswordHash(user.id, await hash(data.password, 12));
}

function requireIdentifier(value: string): AccountIdentifier {
  const identifier = parseAccountIdentifier(value);

  if (!identifier) {
    throw new OtpError(
      "INVALID_IDENTIFIER",
      "Enter a valid email address or Bangladesh mobile number."
    );
  }

  return identifier;
}
