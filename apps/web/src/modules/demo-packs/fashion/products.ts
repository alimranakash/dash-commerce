import type { DemoPackProduct } from "../types";

export const fashionDemoProducts = [
  product("Men", "Tailored Cotton Overshirt", "tailored-cotton-overshirt", "men", "FAS-MEN-001", "3490.00", "4290.00", 32),
  product("Men", "Relaxed Linen Shirt", "relaxed-linen-shirt", "men", "FAS-MEN-002", "2890.00", undefined, 44),
  product("Women", "Fluid Satin Blouse", "fluid-satin-blouse", "women", "FAS-WOM-001", "2990.00", "3690.00", 36),
  product("Women", "Minimal Wrap Dress", "minimal-wrap-dress", "women", "FAS-WOM-002", "4590.00", undefined, 24),
  product("Kids", "Playday Cotton Tee", "playday-cotton-tee", "kids", "FAS-KID-001", "990.00", "1290.00", 70),
  product("Shoes", "Clean Court Sneakers", "clean-court-sneakers", "shoes", "FAS-SHO-001", "3890.00", "4590.00", 22),
  product("Shoes", "Everyday Leather Loafers", "everyday-leather-loafers", "shoes", "FAS-SHO-002", "4290.00", undefined, 18),
  product("Bags", "Structured City Tote", "structured-city-tote", "bags", "FAS-BAG-001", "3290.00", "3890.00", 25),
  product("Accessories", "Brushed Metal Belt", "brushed-metal-belt", "accessories", "FAS-ACC-001", "1290.00", "1590.00", 46),
  product("Accessories", "Lightweight Silk Scarf", "lightweight-silk-scarf", "accessories", "FAS-ACC-003", "1490.00", "1890.00", 38)
] satisfies DemoPackProduct[];

function product(
  imageLabel: string,
  title: string,
  slug: string,
  categorySlug: string,
  sku: string,
  price: string,
  compareAtPrice: string | undefined,
  stockQuantity: number
) {
  return {
    categorySlug,
    compareAtPrice,
    description: `${title} is a fictional fashion demo product. Replace this copy with real fabric, fit, size, care, and styling information before launch.`,
    imageAlt: `${title} fashion placeholder image`,
    imageUrl: createPlaceholderImage(imageLabel, title),
    price,
    shortDescription: `A refined ${categorySlug} piece for a modern fashion storefront.`,
    sku,
    slug,
    stockQuantity,
    title
  } satisfies DemoPackProduct;
}

function createPlaceholderImage(label: string, title: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#f7f2ec"/><stop offset="100%" stop-color="#d9cec2"/></linearGradient></defs><rect width="900" height="1200" fill="url(#g)"/><circle cx="705" cy="180" r="150" fill="#ffffff" opacity=".38"/><path d="M450 210c120 0 216 98 216 220v470H234V430c0-122 96-220 216-220Z" fill="#ffffff" opacity=".52"/><path d="M330 430h240v430H330z" fill="#111111" opacity=".08"/><text x="450" y="535" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#191613">${escapeSvg(label)}</text><text x="450" y="625" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#5f554b">${escapeSvg(title)}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
