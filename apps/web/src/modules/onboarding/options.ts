/**
 * The single list of business types, countries, and their defaults.
 *
 * Registration collects all of this now, and the dashboard's fallback wizard
 * still collects it for anyone who reaches a dashboard without a store — a
 * Google sign-up, or a registration whose store creation failed. Both read from
 * here so the two paths cannot drift into offering different options for the
 * same field.
 */
export const businessTypes = [
  "General Store",
  "Fashion",
  "Electronics",
  "Cosmetics & Beauty"
] as const;

export const countryOptions = {
  Bangladesh: { code: "BD", currency: "BDT", flag: "BD", timezone: "Asia/Dhaka" },
  Canada: { code: "CA", currency: "CAD", flag: "CA", timezone: "America/Toronto" },
  India: { code: "IN", currency: "INR", flag: "IN", timezone: "Asia/Kolkata" },
  "United Kingdom": { code: "GB", currency: "GBP", flag: "GB", timezone: "Europe/London" },
  "United States": { code: "US", currency: "USD", flag: "US", timezone: "America/New_York" }
} as const;

/**
 * Country picks the pair below, but neither is locked to it: a seller based in
 * Dhaka may still price in USD, and `Store.currency` is what every price on the
 * storefront is formatted with.
 */
export const currencyOptions = ["BDT", "CAD", "GBP", "INR", "USD"] as const;

export const timezoneOptions = [
  "America/New_York",
  "America/Toronto",
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Europe/London",
  "UTC"
] as const;

export type BusinessType = (typeof businessTypes)[number];
export type CountryName = keyof typeof countryOptions;

/** Mirrors `storeSlugSchema`'s regex so a form can reject the obvious cases without a round trip. */
export const storeSlugPattern = /^[a-z0-9-]{3,40}$/;

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && (businessTypes as readonly string[]).includes(value);
}

export function isCountryName(value: unknown): value is CountryName {
  return typeof value === "string" && Object.hasOwn(countryOptions, value);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
