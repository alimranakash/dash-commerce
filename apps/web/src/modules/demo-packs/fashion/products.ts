import type { DemoPackProduct } from "../types";

export const fashionDemoProducts = [
  product("Men", "Tailored Cotton Overshirt", "tailored-cotton-overshirt", "men", "FAS-MEN-001", "3490.00", "4290.00", 32),
  product("Men", "Relaxed Linen Shirt", "relaxed-linen-shirt", "men", "FAS-MEN-002", "2890.00", undefined, 44),
  product("Men", "Slim Everyday Chinos", "slim-everyday-chinos", "men", "FAS-MEN-003", "3190.00", "3790.00", 28),
  product("Men", "Soft Knit Polo", "soft-knit-polo", "men", "FAS-MEN-004", "2290.00", undefined, 52),
  product("Women", "Fluid Satin Blouse", "fluid-satin-blouse", "women", "FAS-WOM-001", "2990.00", "3690.00", 36),
  product("Women", "Minimal Wrap Dress", "minimal-wrap-dress", "women", "FAS-WOM-002", "4590.00", undefined, 24),
  product("Women", "Wide Leg Trousers", "wide-leg-trousers", "women", "FAS-WOM-003", "3390.00", "3990.00", 30),
  product("Women", "Ribbed Everyday Top", "ribbed-everyday-top", "women", "FAS-WOM-004", "1690.00", undefined, 68),
  product("Kids", "Playday Cotton Tee", "playday-cotton-tee", "kids", "FAS-KID-001", "990.00", "1290.00", 70),
  product("Kids", "Tiny Explorer Joggers", "tiny-explorer-joggers", "kids", "FAS-KID-002", "1490.00", undefined, 54),
  product("Kids", "Weekend Denim Jacket", "weekend-denim-jacket", "kids", "FAS-KID-003", "2490.00", "2990.00", 26),
  product("Kids", "Soft Stripe Hoodie", "soft-stripe-hoodie", "kids", "FAS-KID-004", "1890.00", undefined, 42),
  product("Shoes", "Clean Court Sneakers", "clean-court-sneakers", "shoes", "FAS-SHO-001", "3890.00", "4590.00", 22),
  product("Shoes", "Everyday Leather Loafers", "everyday-leather-loafers", "shoes", "FAS-SHO-002", "4290.00", undefined, 18),
  product("Shoes", "Soft Walk Sandals", "soft-walk-sandals", "shoes", "FAS-SHO-003", "2190.00", "2690.00", 38),
  product("Shoes", "Urban Runner Trainers", "urban-runner-trainers", "shoes", "FAS-SHO-004", "3690.00", undefined, 29),
  product("Bags", "Structured City Tote", "structured-city-tote", "bags", "FAS-BAG-001", "3290.00", "3890.00", 25),
  product("Bags", "Compact Crossbody Bag", "compact-crossbody-bag", "bags", "FAS-BAG-002", "2490.00", undefined, 40),
  product("Bags", "Weekend Canvas Duffle", "weekend-canvas-duffle", "bags", "FAS-BAG-003", "3990.00", "4690.00", 20),
  product("Bags", "Mini Crescent Shoulder Bag", "mini-crescent-shoulder-bag", "bags", "FAS-BAG-004", "2190.00", undefined, 34),
  product("Accessories", "Brushed Metal Belt", "brushed-metal-belt", "accessories", "FAS-ACC-001", "1290.00", "1590.00", 46),
  product("Accessories", "Soft Rib Beanie", "soft-rib-beanie", "accessories", "FAS-ACC-002", "890.00", undefined, 72),
  product("Accessories", "Lightweight Silk Scarf", "lightweight-silk-scarf", "accessories", "FAS-ACC-003", "1490.00", "1890.00", 38),
  product("Accessories", "Minimal Hoop Set", "minimal-hoop-set", "accessories", "FAS-ACC-004", "1190.00", undefined, 60)
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
