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

const productImages = [
  "/demo-assets/general/products/product-01.webp",
  "/demo-assets/general/products/product-02.webp",
  "/demo-assets/general/products/product-03.webp",
  "/demo-assets/general/products/product-04.webp",
  "/demo-assets/general/products/product-05.webp",
  "/demo-assets/general/products/product-06.webp",
  "/demo-assets/general/products/product-07.webp",
  "/demo-assets/general/products/product-08.webp",
  "/demo-assets/general/products/product-09.webp",
  "/demo-assets/general/products/product-10.webp"
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
    description: `${title} is a fictional demo product prepared for a General Store demo catalog. Use it as starter content, then replace it with your real product details.`,
    imageAlt: `${title} demo product image`,
    imageUrl: productImages[productImageIndex++] ?? "/demo-assets/general/products/product-01.webp",
    price,
    shortDescription: `A practical ${categorySlug.replace("-", " ")} item for everyday customers.`,
    sku,
    slug,
    stockQuantity,
    title
  } satisfies DemoPackProduct;
}
