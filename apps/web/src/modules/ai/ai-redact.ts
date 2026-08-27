/**
 * The redaction primitives the AI response mappers share.
 *
 * Kept apart from the mappers so there is one definition of what "masked" means
 * on this API, and so a reviewer can read the whole of it in one screen rather
 * than trusting that four `slice(-4)` calls agree with each other.
 *
 * Nothing here is reversible and nothing here is a security boundary on its own
 * — the boundary is the allow-listed DTO, which simply never carries the fields
 * these functions would have to protect. These exist for the two values the AI
 * genuinely needs to *recognise* a customer across a conversation without being
 * handed a contact list.
 */

const MASK_CHARACTER = "•";
const VISIBLE_PHONE_DIGITS = 4;

/**
 * Keeps the last four digits, which is how a seller reads a phone number back
 * to themselves, and hides the rest.
 *
 * In Bangladesh the phone number is the customer's identity — `Customer` is
 * keyed `@@unique([storeId, phone])` — so a full number is the single most
 * valuable thing in the orders table. Four digits is enough for the AI to say
 * "the order ending 5678" and not enough to call anybody.
 *
 * The mask keeps the original length so `01712345678` and `+8801712345678` stay
 * distinguishable at a glance.
 */
export function maskPhone(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  if (trimmed.length <= VISIBLE_PHONE_DIGITS) {
    return MASK_CHARACTER.repeat(trimmed.length);
  }

  return (
    MASK_CHARACTER.repeat(trimmed.length - VISIBLE_PHONE_DIGITS) +
    trimmed.slice(-VISIBLE_PHONE_DIGITS)
  );
}

/**
 * Keeps the first character and the domain: `rahim@gmail.com` becomes
 * `r•••@gmail.com`.
 *
 * The domain survives because it is not identifying on its own and it is
 * occasionally the answer to a real question ("are these orders all from the
 * same company"). Anything without an `@` is masked whole rather than guessed
 * at.
 */
export function maskEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  const separator = trimmed.lastIndexOf("@");

  if (separator <= 0) {
    return MASK_CHARACTER.repeat(trimmed.length);
  }

  const local = trimmed.slice(0, separator);
  const domain = trimmed.slice(separator);

  return `${local.slice(0, 1)}${MASK_CHARACTER.repeat(Math.max(1, local.length - 1))}${domain}`;
}

/**
 * Dates cross this boundary as ISO 8601 strings.
 *
 * `JSON.stringify` would produce the same characters, but going through it
 * implicitly means the response schema has to accept `z.date()` and hope — this
 * way the schema says `z.string()` and means it.
 */
export function toIsoString(value: Date): string {
  return value.toISOString();
}

/**
 * Money crosses as a string, following the convention `analytics.service.ts`
 * already uses.
 *
 * Prisma returns `Decimal` for every money column. Serialised as a JSON number
 * it becomes a float and silently loses paisa on values a Bangladeshi store
 * actually charges; as a string it is exact, and the caller decides how to parse
 * it.
 */
export function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

/** The nullable sibling of `decimalToString`, for `compareAtPrice` and friends. */
export function optionalDecimalToString(
  value: { toString(): string } | null | undefined
): string | null {
  return value === null || value === undefined ? null : value.toString();
}
