import type { DemoPackProduct } from "../types";

const productImages = [
  "/demo-assets/electronics/products/product-01.webp",
  "/demo-assets/electronics/products/product-02.webp",
  "/demo-assets/electronics/products/product-03.webp",
  "/demo-assets/electronics/products/product-04.webp",
  "/demo-assets/electronics/products/product-05.webp",
  "/demo-assets/electronics/products/product-06.webp",
  "/demo-assets/electronics/products/product-07.webp",
  "/demo-assets/electronics/products/product-08.webp",
  "/demo-assets/electronics/products/product-09.webp",
  "/demo-assets/electronics/products/product-10.webp"
];

let productImageIndex = 0;

export const electronicsDemoProducts = [
  product("Phone", "Nova X1 Smartphone", "nova-x1-smartphone", "smartphones", "ELE-PHO-001", "24990.00", "28990.00", 24),
  product("Phone", "Orbit Mini 5G Phone", "orbit-mini-5g-phone", "smartphones", "ELE-PHO-002", "18990.00", undefined, 32),
  product("Laptop", "TechBook Air 14", "techbook-air-14", "laptops", "ELE-LAP-001", "68990.00", "74990.00", 12),
  product("Laptop", "CorePad Studio Laptop", "corepad-studio-laptop", "laptops", "ELE-LAP-002", "84990.00", undefined, 10),
  product("Gear", "MagDock Charging Stand", "magdock-charging-stand", "accessories", "ELE-ACC-001", "2490.00", "2990.00", 60),
  product("Home", "Smart Home Hub", "smart-home-hub", "smart-home", "ELE-HOM-001", "7990.00", "8990.00", 20),
  product("Gaming", "Mechanical Keyboard Pro", "mechanical-keyboard-pro", "gaming", "ELE-GAM-001", "6490.00", "7490.00", 28),
  product("Gaming", "UltraView Monitor", "ultraview-monitor", "gaming", "ELE-GAM-002", "28990.00", undefined, 9),
  product("Audio", "Pulse Wireless Earbuds", "pulse-wireless-earbuds", "audio", "ELE-AUD-001", "4990.00", "5990.00", 42),
  product("Audio", "StudioBeat Headphones", "studiobeat-headphones", "audio", "ELE-AUD-003", "8990.00", "9990.00", 18)
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
    description: `${title} is a fictional electronics demo product. Replace this copy with real specifications, warranty details, compatibility notes, and package contents before launch.`,
    imageAlt: `${title} electronics demo product image`,
    imageUrl: productImages[productImageIndex++] ?? "/demo-assets/electronics/products/product-01.webp",
    price,
    shortDescription: `A fictional ${categorySlug.replace("-", " ")} product for a modern electronics storefront.`,
    sku,
    slug,
    stockQuantity,
    title
  } satisfies DemoPackProduct;
}
