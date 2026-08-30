// Footer link + copyright helpers shared by the default, fashion, and
// electronics footers so a seller-entered "/products" resolves the same way
// everywhere and the copyright template is expanded once.
export function resolveStorefrontHref(homeHref: string, url: string) {
  if (url.startsWith("http") || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("#")) {
    return url;
  }

  if (url === "/") {
    // On a storefront hostname homeHref is empty, and an empty href is not a link.
    return homeHref || "/";
  }

  return `${homeHref}${url.startsWith("/") ? url : `/${url}`}`;
}

export function resolveStorefrontCopyright(template: string, storeName: string) {
  return template
    .replaceAll("{year}", String(new Date().getFullYear()))
    .replaceAll("{store}", storeName);
}

/** The platform's own name, as it appears in the default copyright line. */
export const STOREIM_BRAND_TOKEN = "StoreIM";

/**
 * Where the credit points. Hardcoded rather than derived from
 * `PLATFORM_ROOT_DOMAIN` so the word and the link always name the same company:
 * the token above is literal, so a deployment that moved its root domain would
 * otherwise send shoppers reading "StoreIM" somewhere else.
 */
export const STOREIM_SITE_URL = "https://storeim.com/";

/**
 * The copyright line split around every mention of the platform's name, so the
 * footer can render the brand as a link and the rest as text.
 *
 * The split happens on the *template*, before `{store}` is expanded, which is
 * what stops a shop that happens to be called StoreIM having its own name
 * turned into a link to us. Segments come back fully expanded; the brand token
 * belongs between each adjacent pair.
 */
export function splitStorefrontCopyright(template: string, storeName: string) {
  return template
    .split(STOREIM_BRAND_TOKEN)
    .map((segment) => resolveStorefrontCopyright(segment, storeName));
}
