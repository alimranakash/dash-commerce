// One money formatter for every storefront surface. Store currencies are
// three-letter codes, and the narrow symbol keeps BDT rendering as the taka
// sign instead of the bare "BDT" code that the default display produces.
export function formatStorefrontMoney(value: number | string | { toString(): string }, currency: string) {
  const amount = Number(typeof value === "object" ? value.toString() : value);
  const code = /^[A-Za-z]{3}$/.test(currency.trim()) ? currency.trim().toUpperCase() : "BDT";

  return new Intl.NumberFormat("en", {
    currency: code,
    currencyDisplay: "narrowSymbol",
    style: "currency"
  }).format(Number.isFinite(amount) ? amount : 0);
}

/**
 * What a shopper is told when they are buying something that is not here yet.
 *
 * The date is the point of it: "pre-order" on its own reads as a delay of
 * unknown length, which is how a seller loses the order they just took.
 *
 * Here rather than beside `StockStatus` because that file is a client module,
 * and the AI Shopping Agent has to write the same sentence on the server. Two
 * copies of it would drift, and a chat bubble promising a different ship date
 * from the card next to it is worse than no date at all.
 */
export function preorderLabel(releaseAt: Date | string | null | undefined) {
  if (!releaseAt) {
    return "Pre-order";
  }

  const date = new Date(releaseAt);

  if (Number.isNaN(date.getTime())) {
    return "Pre-order";
  }

  return `Pre-order · ships around ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date)}`;
}
