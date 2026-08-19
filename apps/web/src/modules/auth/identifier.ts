import { normalizeBangladeshPhone } from "../courier/courier-phone";

/**
 * One sign-in box, two kinds of account handle.
 *
 * Everything downstream needs to know *which* of the two a visitor typed before
 * it can look anything up — the credentials provider to choose a unique column,
 * and later the OTP challenge to choose between an email and an SMS. Deciding
 * that in one place is what keeps the answer identical everywhere, so the number
 * someone signs in with is the same number a code was sent to.
 *
 * The split is on `@` rather than on "does this parse as an email", because a
 * mistyped address has to stay an email problem the visitor can recognise
 * instead of silently becoming a confusing complaint about a phone number.
 */

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AccountIdentifier = { channel: "EMAIL"; email: string } | { channel: "SMS"; phone: string };

/** Returns null when the value is neither a usable email nor a Bangladesh mobile number. */
export function parseAccountIdentifier(value: string | null | undefined): AccountIdentifier | null {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();

    return emailPattern.test(email) ? { channel: "EMAIL", email } : null;
  }

  const phone = normalizeBangladeshPhone(trimmed);

  return phone ? { channel: "SMS", phone } : null;
}

/**
 * The `where` for a `findUnique` on whichever column the identifier belongs to.
 * Both columns are unique and nullable, so exactly one row can ever match.
 */
export function accountIdentifierWhere(identifier: AccountIdentifier) {
  return identifier.channel === "EMAIL" ? { email: identifier.email } : { phone: identifier.phone };
}
