import { hash } from "bcryptjs";
import { parseAccountIdentifier, type AccountIdentifier } from "./identifier";
import { OtpError } from "./otp/otp-errors";
import {
  registrationPayloadSchema,
  requestRegistrationCodeSchema,
  verifyRegistrationCodeSchema
} from "./otp/otp.schema";
import { requestOtpChallenge, verifyOtpChallenge } from "./otp/otp.service";
import { createVerifiedUser, findUserByIdentifier } from "./account.repository";

/**
 * Sign-up, in two halves either side of a verification code.
 *
 * No User row exists until the code is confirmed. An unverified account created
 * up front would sit on the unique email or phone it claimed, which is how
 * someone squats a number they do not own — and it would leave the table filling
 * with abandoned half-registrations that something else then has to purge.
 */

/** `input` is untrusted request JSON; the schema is what makes it a draft. */
export async function requestRegistrationCode(
  input: unknown,
  context: { ipAddress: string | null }
) {
  const data = requestRegistrationCodeSchema.parse(input);
  const identifier = requireIdentifier(data.identifier);

  if (await findUserByIdentifier(identifier)) {
    throw new OtpError("ALREADY_REGISTERED", alreadyRegisteredMessage(identifier));
  }

  // Hashed before it is written to the challenge, so a row waiting on a code is
  // no more sensitive than the account it is about to become.
  const passwordHash = await hash(data.password, 12);

  return requestOtpChallenge({
    identifier,
    ipAddress: context.ipAddress,
    payload: { name: data.name, passwordHash },
    purpose: "REGISTRATION"
  });
}

export async function verifyRegistrationCode(input: unknown) {
  const data = verifyRegistrationCodeSchema.parse(input);
  const identifier = requireIdentifier(data.identifier);
  const challenge = await verifyOtpChallenge({
    code: data.code,
    identifier,
    purpose: "REGISTRATION"
  });
  const payload = registrationPayloadSchema.parse(challenge.payload);

  // Minutes can pass between asking for a code and typing it — long enough for
  // the same handle to have been claimed by another sign-up in between.
  if (await findUserByIdentifier(identifier)) {
    throw new OtpError("ALREADY_REGISTERED", alreadyRegisteredMessage(identifier));
  }

  return createVerifiedUser({
    identifier,
    name: payload.name,
    passwordHash: payload.passwordHash,
    verifiedAt: new Date()
  });
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

function alreadyRegisteredMessage(identifier: AccountIdentifier) {
  return identifier.channel === "EMAIL"
    ? "An account with this email already exists."
    : "An account with this phone number already exists.";
}
