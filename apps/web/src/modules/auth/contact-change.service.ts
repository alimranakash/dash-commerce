import { findUserByIdentifier, getAccountContacts, updateUserContact } from "./account.repository";
import { parseAccountIdentifier, type AccountIdentifier } from "./identifier";
import { OtpError } from "./otp/otp-errors";
import { contactChangePayloadSchema, contactChangeSchema } from "./otp/otp.schema";
import { requestOtpChallenge, verifyOtpChallenge } from "./otp/otp.service";

/**
 * Changing the email or phone an account signs in with.
 *
 * The code goes to the *new* handle, never the old one: what has to be proven
 * is that the person asking can actually receive mail or messages there. A code
 * sent to the address already on file would prove only what we already knew,
 * and would happily attach a stranger's number to the account.
 */

export async function requestContactChangeCode(
  userId: string,
  input: unknown,
  context: { ipAddress: string | null }
) {
  const data = contactChangeSchema.parse(input);
  const identifier = requireIdentifier(data.identifier);

  await assertClaimable(identifier, userId);

  return requestOtpChallenge({
    identifier,
    ipAddress: context.ipAddress,
    payload: { userId },
    purpose: "CONTACT_CHANGE"
  });
}

export async function confirmContactChange(userId: string, input: unknown) {
  const data = contactChangeSchema.parse(input);
  const identifier = requireIdentifier(data.identifier);

  if (!data.code) {
    throw new OtpError("INVALID_CODE", "Enter the 6-digit code we sent.");
  }

  const challenge = await verifyOtpChallenge({
    code: data.code,
    identifier,
    purpose: "CONTACT_CHANGE"
  });
  const payload = contactChangePayloadSchema.parse(challenge.payload);

  // The challenge names the account the change was started from. Trusting the
  // session instead would let a code sent for one account be spent on another
  // by signing out and back in as someone else mid-flow.
  if (payload.userId !== userId) {
    throw new OtpError("CHALLENGE_NOT_FOUND", "That code was not meant for this account.");
  }

  // Re-checked after the code, because the wait between asking and confirming is
  // long enough for someone else to have claimed the same handle.
  await assertClaimable(identifier, userId);

  return updateUserContact({ identifier, userId, verifiedAt: new Date() });
}

async function assertClaimable(identifier: AccountIdentifier, userId: string) {
  const existing = await findUserByIdentifier(identifier);

  if (existing && existing.id !== userId) {
    throw new OtpError(
      "ALREADY_REGISTERED",
      identifier.channel === "EMAIL"
        ? "Another account already uses that email address."
        : "Another account already uses that phone number."
    );
  }

  const contacts = await getAccountContacts(userId);

  if (!contacts) {
    throw new OtpError("INVALID_IDENTIFIER", "That account no longer exists.");
  }

  // Swapping the only handle on an account for one that is already on it would
  // be a no-op; swapping it for a different one is fine, since the new one is
  // written in the same statement the old one is replaced by.
  const current = identifier.channel === "EMAIL" ? contacts.email : contacts.phone;

  if (current !== null && current === (identifier.channel === "EMAIL" ? identifier.email : identifier.phone)) {
    throw new OtpError(
      "INVALID_IDENTIFIER",
      identifier.channel === "EMAIL"
        ? "That is already the email on this account."
        : "That is already the number on this account."
    );
  }
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
