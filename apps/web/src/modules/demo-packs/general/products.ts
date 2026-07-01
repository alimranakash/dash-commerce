import type { DemoPackProduct } from "../types";

export const generalDemoProducts = [
  product("Electronics", "Nova Wireless Headphones", "nova-wireless-headphones", "electronics", "GEN-ELE-001", "2890.00", "3490.00", 42),
  product("Electronics", "Pocket LED Speaker", "pocket-led-speaker", "electronics", "GEN-ELE-002", "1890.00", undefined, 35),
  product("Home", "Cozy Throw Pillow", "cozy-throw-pillow", "home-living", "GEN-HOM-001", "890.00", "1090.00", 64),
  product("Home", "Foldable Storage Basket", "foldable-storage-basket", "home-living", "GEN-HOM-002", "1190.00", undefined, 48),
  product("Kitchen", "Everyday Coffee Brewer", "everyday-coffee-brewer", "kitchen", "GEN-KIT-001", "3290.00", "3890.00", 18),
  product("Kitchen", "Ceramic Mixing Bowl Set", "ceramic-mixing-bowl-set", "kitchen", "GEN-KIT-002", "1790.00", undefined, 46),
  product("Office", "Adjustable Laptop Stand", "adjustable-laptop-stand", "office", "GEN-OFF-001", "2290.00", "2790.00", 33),
  product("Office", "Smooth Writing Notebook Set", "smooth-writing-notebook-set", "office", "GEN-OFF-002", "690.00", undefined, 90),
  product("Sports", "Flex Training Bottle", "flex-training-bottle", "sports", "GEN-SPO-001", "790.00", "990.00", 82),
  product("Carry", "City Travel Backpack", "city-travel-backpack", "accessories", "GEN-ACC-001", "2990.00", "3590.00", 27)
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
    description: `${title} is a fictional demo product prepared for a General Store demo catalog. Use it as starter content, then replace it with your real product details.`,
    imageAlt: `${title} placeholder image`,
    imageUrl: createPlaceholderImage(imageLabel, title),
    price,
    shortDescription: `A practical ${categorySlug.replace("-", " ")} item for everyday customers.`,
    sku,
    slug,
    stockQuantity,
    title
  } satisfies DemoPackProduct;
}

function createPlaceholderImage(label: string, title: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#f2efe7"/><stop offset="100%" stop-color="#d6ebe7"/></linearGradient></defs><rect width="900" height="1100" fill="url(#g)"/><circle cx="682" cy="220" r="150" fill="#ffffff" opacity=".45"/><rect x="180" y="310" width="540" height="430" rx="54" fill="#ffffff" opacity=".62"/><text x="450" y="502" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#135d66">${escapeSvg(label)}</text><text x="450" y="590" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#4b635f">${escapeSvg(title)}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
