import type { DemoPackProduct } from "../types";

export const generalDemoProducts = [
  product("Electronics", "Nova Wireless Headphones", "nova-wireless-headphones", "electronics", "GEN-ELE-001", "2890.00", "3490.00", 42),
  product("Electronics", "Pocket LED Speaker", "pocket-led-speaker", "electronics", "GEN-ELE-002", "1890.00", undefined, 35),
  product("Electronics", "Compact Desk Charger", "compact-desk-charger", "electronics", "GEN-ELE-003", "1490.00", "1790.00", 50),
  product("Electronics", "Smart Home Sensor", "smart-home-sensor", "electronics", "GEN-ELE-004", "2190.00", undefined, 28),
  product("Home", "Cozy Throw Pillow", "cozy-throw-pillow", "home-living", "GEN-HOM-001", "890.00", "1090.00", 64),
  product("Home", "Foldable Storage Basket", "foldable-storage-basket", "home-living", "GEN-HOM-002", "1190.00", undefined, 48),
  product("Home", "Minimal Wall Clock", "minimal-wall-clock", "home-living", "GEN-HOM-003", "1590.00", "1990.00", 31),
  product("Home", "Soft Bedside Lamp", "soft-bedside-lamp", "home-living", "GEN-HOM-004", "2490.00", undefined, 22),
  product("Kitchen", "Everyday Coffee Brewer", "everyday-coffee-brewer", "kitchen", "GEN-KIT-001", "3290.00", "3890.00", 18),
  product("Kitchen", "Ceramic Mixing Bowl Set", "ceramic-mixing-bowl-set", "kitchen", "GEN-KIT-002", "1790.00", undefined, 46),
  product("Kitchen", "Bamboo Cutting Board", "bamboo-cutting-board", "kitchen", "GEN-KIT-003", "990.00", "1190.00", 72),
  product("Kitchen", "Quick Heat Kettle", "quick-heat-kettle", "kitchen", "GEN-KIT-004", "2690.00", undefined, 26),
  product("Office", "Adjustable Laptop Stand", "adjustable-laptop-stand", "office", "GEN-OFF-001", "2290.00", "2790.00", 33),
  product("Office", "Smooth Writing Notebook Set", "smooth-writing-notebook-set", "office", "GEN-OFF-002", "690.00", undefined, 90),
  product("Office", "Cable Organizer Kit", "cable-organizer-kit", "office", "GEN-OFF-003", "590.00", "790.00", 120),
  product("Office", "Focus Desk Mat", "focus-desk-mat", "office", "GEN-OFF-004", "1290.00", undefined, 54),
  product("Sports", "Flex Training Bottle", "flex-training-bottle", "sports", "GEN-SPO-001", "790.00", "990.00", 82),
  product("Sports", "Grip Yoga Mat", "grip-yoga-mat", "sports", "GEN-SPO-002", "1890.00", undefined, 36),
  product("Sports", "Light Jump Rope", "light-jump-rope", "sports", "GEN-SPO-003", "490.00", "650.00", 100),
  product("Sports", "Trail Waist Pouch", "trail-waist-pouch", "sports", "GEN-SPO-004", "990.00", undefined, 44),
  product("Carry", "City Travel Backpack", "city-travel-backpack", "accessories", "GEN-ACC-001", "2990.00", "3590.00", 27),
  product("Carry", "Everyday Tote Bag", "everyday-tote-bag", "accessories", "GEN-ACC-002", "1190.00", undefined, 58),
  product("Carry", "Slim Card Holder", "slim-card-holder", "accessories", "GEN-ACC-003", "690.00", "890.00", 76),
  product("Carry", "Weather Mini Umbrella", "weather-mini-umbrella", "accessories", "GEN-ACC-004", "1090.00", undefined, 40)
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
