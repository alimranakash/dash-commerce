/**
 * Timestamp parsing for carrier payloads.
 *
 * Both carriers send `"2025-03-02 12:45:30"` with no timezone at all. Read as
 * UTC — which is what `new Date()` does with an ISO-ish string carrying a `T` —
 * that is six hours in the future, and a future timestamp trips
 * `applyShipmentStatus`'s out-of-order guard against every event that follows
 * it. Bangladesh Standard Time is a fixed UTC+6 with no daylight saving, so the
 * correction is a constant.
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const NAIVE_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Returns `undefined` rather than an Invalid Date for anything unparseable, so
 * the caller falls back to "now" instead of writing a broken timestamp.
 */
export function parseCarrierTimestamp(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "number") {
    // Seconds or milliseconds — anything below this threshold cannot be a
    // sensible millisecond epoch.
    const date = new Date(value < 1e12 ? value * 1000 : value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const raw = value.trim();
  const naive = NAIVE_TIMESTAMP.exec(raw);

  if (naive) {
    const [, year, month, day, hour, minute, second] = naive;
    const asUtc = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? "0")
    );

    return new Date(asUtc - DHAKA_OFFSET_MS);
  }

  // Anything carrying its own offset or `Z` is already unambiguous.
  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
