import type { DemoPackProduct } from "../types";

export const beautyDemoProducts = [
  product("Skincare", "Glow Serum", "glow-serum", "skincare", "BEA-SKI-001", "2490.00", "2990.00", 36),
  product("Skincare", "Daily Face Cleanser", "daily-face-cleanser", "skincare", "BEA-SKI-002", "1490.00", undefined, 54),
  product("Skincare", "Cloud Cream Moisturizer", "cloud-cream-moisturizer", "skincare", "BEA-SKI-003", "2190.00", "2590.00", 42),
  product("Skincare", "Calm Skin Toner", "calm-skin-toner", "skincare", "BEA-SKI-004", "1290.00", undefined, 48),
  product("Makeup", "Soft Matte Lip Color", "soft-matte-lip-color", "makeup", "BEA-MAK-001", "1190.00", "1490.00", 68),
  product("Makeup", "Velvet Skin Tint", "velvet-skin-tint", "makeup", "BEA-MAK-002", "2290.00", undefined, 32),
  product("Makeup", "Lush Brow Gel", "lush-brow-gel", "makeup", "BEA-MAK-003", "990.00", "1190.00", 58),
  product("Makeup", "Rose Glow Blush", "rose-glow-blush", "makeup", "BEA-MAK-004", "1590.00", undefined, 45),
  product("Hair", "Silk Hair Mask", "silk-hair-mask", "hair-care", "BEA-HAI-001", "1890.00", "2290.00", 34),
  product("Hair", "Soft Shine Shampoo", "soft-shine-shampoo", "hair-care", "BEA-HAI-002", "1390.00", undefined, 50),
  product("Hair", "Nourish Hair Oil", "nourish-hair-oil", "hair-care", "BEA-HAI-003", "1690.00", "1990.00", 39),
  product("Hair", "Volume Mist Spray", "volume-mist-spray", "hair-care", "BEA-HAI-004", "1290.00", undefined, 46),
  product("Scent", "Fresh Bloom Perfume", "fresh-bloom-perfume", "fragrance", "BEA-FRA-001", "3490.00", "3990.00", 24),
  product("Scent", "Amber Petal Mist", "amber-petal-mist", "fragrance", "BEA-FRA-002", "2190.00", undefined, 30),
  product("Scent", "Soft Musk Roll-On", "soft-musk-roll-on", "fragrance", "BEA-FRA-003", "890.00", "1090.00", 62),
  product("Scent", "Citrus Garden Spray", "citrus-garden-spray", "fragrance", "BEA-FRA-004", "2490.00", undefined, 28),
  product("Body", "Velvet Body Lotion", "velvet-body-lotion", "body-care", "BEA-BOD-001", "1590.00", "1890.00", 52),
  product("Body", "Sugar Polish Scrub", "sugar-polish-scrub", "body-care", "BEA-BOD-002", "1390.00", undefined, 44),
  product("Body", "Soft Foam Body Wash", "soft-foam-body-wash", "body-care", "BEA-BOD-003", "1090.00", "1290.00", 70),
  product("Body", "Hand Cream Duo", "hand-cream-duo", "body-care", "BEA-BOD-004", "990.00", undefined, 66),
  product("Tools", "Beauty Sponge Set", "beauty-sponge-set", "beauty-tools", "BEA-TOO-001", "790.00", "990.00", 80),
  product("Tools", "Soft Blend Brush Kit", "soft-blend-brush-kit", "beauty-tools", "BEA-TOO-002", "2290.00", undefined, 27),
  product("Tools", "Cooling Facial Roller", "cooling-facial-roller", "beauty-tools", "BEA-TOO-003", "1490.00", "1790.00", 36),
  product("Tools", "Clean Travel Pouch", "clean-travel-pouch", "beauty-tools", "BEA-TOO-004", "1190.00", undefined, 55)
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
    description: `${title} is a fictional cosmetics and beauty demo product. Replace this copy with real ingredients, skin type notes, usage instructions, and safety details before launch.`,
    imageAlt: `${title} beauty placeholder image`,
    imageUrl: createPlaceholderImage(imageLabel, title),
    price,
    shortDescription: `A soft fictional ${categorySlug.replace("-", " ")} product for a beauty storefront.`,
    sku,
    slug,
    stockQuantity,
    title
  } satisfies DemoPackProduct;
}

function createPlaceholderImage(label: string, title: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#fff8f2"/><stop offset="100%" stop-color="#fce7f3"/></linearGradient></defs><rect width="900" height="1100" fill="url(#g)"/><circle cx="710" cy="210" r="150" fill="#ffffff" opacity=".5"/><rect x="330" y="250" width="240" height="540" rx="72" fill="#ffffff" opacity=".72"/><rect x="372" y="190" width="156" height="90" rx="36" fill="#be185d" opacity=".32"/><circle cx="260" cy="720" r="88" fill="#be185d" opacity=".12"/><text x="450" y="506" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#be185d">${escapeSvg(label)}</text><text x="450" y="592" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#7d5363">${escapeSvg(title)}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
