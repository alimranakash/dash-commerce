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
