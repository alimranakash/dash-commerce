import type { SalesNotificationNameDisplay } from "./sales-notifications.schema";

/**
 * Turning an order row into a sentence a stranger may read.
 *
 * Its own module, with no database import, for two reasons. The storefront
 * service uses it to decide what the browser is ever sent; the dashboard's live
 * preview uses it in the browser to show the seller exactly what a customer will
 * read as they change the setting. A preview that redacted names by its own
 * second implementation would be a preview that is allowed to be wrong about the
 * one thing this panel exists to decide.
 *
 * It is also what `npm run verify:sales-notifications` exercises: both functions
 * are pure, so the privacy rules can be checked without a database.
 */

/**
 * What a stranger is told the buyer was called.
 *
 * Checkout takes a free-text name, so this has to cope with "  rahim   uddin ",
 * a full sentence, and a phone number typed into the wrong box. Everything is
 * cut to two tokens and 24 characters, and anything with no letters in it falls
 * back to "Someone" — a card reading "01712… just purchased" would publish a
 * customer's phone number to every visitor of the shop.
 */
export function redactBuyerName(
  name: string | null | undefined,
  display: SalesNotificationNameDisplay
): string {
  const anonymous = "Someone";

  if (display === "anonymous") {
    return anonymous;
  }

  const tokens = String(name ?? "")
    .replace(/[^\p{L}\p{M}'’.\- ]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => /\p{L}/u.test(token));

  const first = tokens[0];

  if (!first) {
    return anonymous;
  }

  const given = capitalize(first).slice(0, 24);

  if (display === "first_name") {
    return given;
  }

  const family = tokens[1];

  // `initial` with a one-word name is the first name on its own rather than a
  // bare letter: "Rahim" is already less than the shop knows, and "R." reads as
  // a redaction error.
  return family ? `${given} ${capitalize(family).slice(0, 1)}.` : given;
}

/**
 * The town, and nothing finer.
 *
 * City first, district as the fallback, first comma-segment only, 32
 * characters. `shippingArea` is deliberately never consulted: it is the
 * neighbourhood, and a neighbourhood plus a first name plus a timestamp is close
 * enough to an address to be worth not publishing.
 *
 * A segment containing a digit is thrown away rather than printed. Checkout
 * takes these fields as text, so a shopper who typed their whole address into
 * the city box would otherwise put "House 12" on the shop's homepage — and a
 * town whose name needs a number in it is rare enough to be worth losing.
 */
export function resolveLocation(
  city: string | null | undefined,
  district: string | null | undefined
): string | null {
  for (const value of [city, district]) {
    const segment =
      String(value ?? "")
        .split(",")[0]
        ?.trim() ?? "";

    if (segment && /\p{L}/u.test(segment) && !/\d/u.test(segment)) {
      return segment.slice(0, 32);
    }
  }

  return null;
}

function capitalize(value: string) {
  const first = value.slice(0, 1);

  return `${first.toLocaleUpperCase("en")}${value.slice(1)}`;
}
