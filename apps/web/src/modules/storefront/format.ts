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
