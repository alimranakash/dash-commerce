import type { DemoPackProduct } from "../types";

export const beautyDemoProducts = [
  product("Skincare", "Glow Serum", "glow-serum", "skincare", "BEA-SKI-001", "2490.00", "2990.00", 36),
  product("Skincare", "Daily Face Cleanser", "daily-face-cleanser", "skincare", "BEA-SKI-002", "1490.00", undefined, 54),
  product("Makeup", "Soft Matte Lip Color", "soft-matte-lip-color", "makeup", "BEA-MAK-001", "1190.00", "1490.00", 68),
  product("Makeup", "Velvet Skin Tint", "velvet-skin-tint", "makeup", "BEA-MAK-002", "2290.00", undefined, 32),
  product("Hair", "Silk Hair Mask", "silk-hair-mask", "hair-care", "BEA-HAI-001", "1890.00", "2290.00", 34),
  product("Scent", "Fresh Bloom Perfume", "fresh-bloom-perfume", "fragrance", "BEA-FRA-001", "3490.00", "3990.00", 24),
  product("Scent", "Amber Petal Mist", "amber-petal-mist", "fragrance", "BEA-FRA-002", "2190.00", undefined, 30),
  product("Body", "Velvet Body Lotion", "velvet-body-lotion", "body-care", "BEA-BOD-001", "1590.00", "1890.00", 52),
  product("Tools", "Beauty Sponge Set", "beauty-sponge-set", "beauty-tools", "BEA-TOO-001", "790.00", "990.00", 80),
  product("Tools", "Soft Blend Brush Kit", "soft-blend-brush-kit", "beauty-tools", "BEA-TOO-002", "2290.00", undefined, 27)
] satisfies DemoPackProduct[];

const productImages = [
  "/demo-assets/beauty/products/product-01.webp",
  "/demo-assets/beauty/products/product-02.webp",
  "/demo-assets/beauty/products/product-03.webp",
  "/demo-assets/beauty/products/product-04.webp",
  "/demo-assets/beauty/products/product-05.webp",
  "/demo-assets/beauty/products/product-06.webp",
  "/demo-assets/beauty/products/product-07.webp",
  "/demo-assets/beauty/products/product-08.webp",
  "/demo-assets/beauty/products/product-09.webp",
  "/demo-assets/beauty/products/product-10.webp"
];

let productImageIndex = 0;

function product(
  _imageLabel: string,
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
    imageAlt: `${title} beauty demo product image`,
    imageUrl: productImages[productImageIndex++] ?? "/demo-assets/beauty/products/product-01.webp",
    price,
    shortDescription: `A soft fictional ${categorySlug.replace("-", " ")} product for a beauty storefront.`,
    sku,
    slug,
    stockQuantity,
    title
  } satisfies DemoPackProduct;
}
