/**
 * Recipient phone normalization for courier bookings.
 *
 * Carriers here are Bangladesh-only and strict: Steadfast rejects anything that
 * is not an 11-digit local mobile number. Normalizing and validating before a
 * booking is dispatched keeps a bad number a local validation error instead of a
 * carrier rejection — which matters most in a bulk run, where the failure would
 * otherwise only surface in the per-item response after the parcels were sent.
 */

const bangladeshMobilePattern = /^01[3-9]\d{8}$/;

/**
 * Returns the canonical `01XXXXXXXXX` form, or `null` when the value is not a
 * valid Bangladesh mobile number. Accepts spacing, dashes, and the `+880` / `880`
 * country prefix, plus the common 10-digit form written without its leading zero.
 *
 * Callers decide what a `null` means: it fails a booking for `recipient_phone`,
 * and is silently dropped for the optional `alternative_phone`.
 */
export function normalizeBangladeshPhone(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("880")) {
    digits = digits.slice(3);
  }

  if (digits.length === 10 && digits.startsWith("1")) {
    digits = `0${digits}`;
  }

  return bangladeshMobilePattern.test(digits) ? digits : null;
}
