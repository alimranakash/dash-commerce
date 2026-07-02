import type { DemoPackProduct } from "../types";

const productImages = [
  "/demo-assets/fashion/products/product-01.webp",
  "/demo-assets/fashion/products/product-02.webp",
  "/demo-assets/fashion/products/product-03.webp",
  "/demo-assets/fashion/products/product-04.webp",
  "/demo-assets/fashion/products/product-05.webp",
  "/demo-assets/fashion/products/product-06.webp",
  "/demo-assets/fashion/products/product-07.webp",
  "/demo-assets/fashion/products/product-08.webp",
  "/demo-assets/fashion/products/product-09.webp",
  "/demo-assets/fashion/products/product-10.webp"
];

let productImageIndex = 0;

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
    description: `${title} is a fictional fashion demo product. Replace this copy with real fabric, fit, size, care, and styling information before launch.`,
    imageAlt: `${title} fashion demo product image`,
    imageUrl: productImages[productImageIndex++] ?? "/demo-assets/fashion/products/product-01.webp",
    price,
    shortDescription: `A refined ${categorySlug} piece for a modern fashion storefront.`,
    sku,
    slug,
    stockQuantity,
    title
  } satisfies DemoPackProduct;
}
