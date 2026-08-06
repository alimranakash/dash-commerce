import type { DemoPackMediaAsset } from "../types";
import { generalDemoBrands } from "./brands";
import { generalDemoCategories } from "./categories";
import { generalDemoProducts } from "./products";

/**
 * Byte size and pixel dimensions of every file under
 * apps/web/public/demo-assets/general/, measured from the committed images.
 *
 * MediaAsset.size is a required column and width/height drive the library grid,
 * so the numbers are baked in here rather than stat-ed while an import runs -
 * seeding never touches the filesystem. Re-measure this table if an image is
 * replaced; `assetFor` throws on a path that is missing from it, which surfaces
 * the drift immediately instead of writing a zero-byte row.
 */
const fileMetrics: Record<string, { height: number; size: number; width: number }> = {
  "/demo-assets/general/banners/promo-primary.webp": { height: 810, size: 56570, width: 2160 },
  "/demo-assets/general/banners/promo-secondary.webp": { height: 638, size: 45408, width: 1701 },
  "/demo-assets/general/brands/brewhaus.webp": { height: 1024, size: 145244, width: 2048 },
  "/demo-assets/general/brands/deskline.webp": { height: 817, size: 17482, width: 1632 },
  "/demo-assets/general/brands/hearthly.webp": { height: 818, size: 48164, width: 1632 },
  "/demo-assets/general/brands/novaline.webp": { height: 1024, size: 80850, width: 2048 },
  "/demo-assets/general/brands/papermark.webp": { height: 926, size: 58196, width: 1852 },
  "/demo-assets/general/brands/peakline.webp": { height: 1024, size: 132990, width: 2048 },
  "/demo-assets/general/brands/trailform.webp": { height: 816, size: 97914, width: 1632 },
  "/demo-assets/general/brands/vessel-co.webp": { height: 936, size: 75000, width: 1872 },
  "/demo-assets/general/brands/voltway.webp": { height: 1024, size: 139500, width: 2048 },
  "/demo-assets/general/categories/accessories.webp": { height: 805, size: 27004, width: 805 },
  "/demo-assets/general/categories/electronics.webp": { height: 780, size: 45124, width: 780 },
  "/demo-assets/general/categories/home-living.webp": { height: 779, size: 98098, width: 779 },
  "/demo-assets/general/categories/kitchen.webp": { height: 820, size: 43756, width: 820 },
  "/demo-assets/general/categories/office.webp": { height: 780, size: 38456, width: 780 },
  "/demo-assets/general/categories/sports.webp": { height: 735, size: 44802, width: 735 },
  "/demo-assets/general/hero/hero-01.webp": { height: 875, size: 166972, width: 2100 },
  "/demo-assets/general/hero/hero-02.webp": { height: 1600, size: 268570, width: 3840 },
  "/demo-assets/general/hero/hero-03.webp": { height: 700, size: 21532, width: 1680 },
  "/demo-assets/general/hero/hero-mobile.webp": { height: 936, size: 21458, width: 702 },
  "/demo-assets/general/products/adjustable-laptop-stand-1.webp": {
    height: 3024,
    size: 146940,
    width: 3024
  },
  "/demo-assets/general/products/adjustable-laptop-stand-2.webp": {
    height: 880,
    size: 41956,
    width: 880
  },
  "/demo-assets/general/products/adjustable-skipping-rope-1.webp": {
    height: 806,
    size: 32986,
    width: 806
  },
  "/demo-assets/general/products/adjustable-skipping-rope-2.webp": {
    height: 792,
    size: 24156,
    width: 792
  },
  "/demo-assets/general/products/bedside-reading-lamp-1.webp": {
    height: 754,
    size: 5908,
    width: 754
  },
  "/demo-assets/general/products/bedside-reading-lamp-2.webp": {
    height: 764,
    size: 8698,
    width: 764
  },
  "/demo-assets/general/products/ceramic-mixing-bowl-set-1.webp": {
    height: 668,
    size: 8906,
    width: 668
  },
  "/demo-assets/general/products/ceramic-mixing-bowl-set-2.webp": {
    height: 780,
    size: 21752,
    width: 780
  },
  "/demo-assets/general/products/city-travel-backpack-1.webp": {
    height: 780,
    size: 26374,
    width: 780
  },
  "/demo-assets/general/products/city-travel-backpack-2.webp": {
    height: 780,
    size: 33048,
    width: 780
  },
  "/demo-assets/general/products/cozy-throw-pillow-1.webp": {
    height: 880,
    size: 17242,
    width: 880
  },
  "/demo-assets/general/products/cozy-throw-pillow-2.webp": {
    height: 880,
    size: 28330,
    width: 880
  },
  "/demo-assets/general/products/desk-organiser-tray-1.webp": {
    height: 780,
    size: 29986,
    width: 780
  },
  "/demo-assets/general/products/desk-organiser-tray-2.webp": {
    height: 880,
    size: 83256,
    width: 880
  },
  "/demo-assets/general/products/everyday-coffee-brewer-1.webp": {
    height: 780,
    size: 51176,
    width: 780
  },
  "/demo-assets/general/products/everyday-coffee-brewer-2.webp": {
    height: 733,
    size: 37526,
    width: 733
  },
  "/demo-assets/general/products/everyday-tote-bag-1.webp": {
    height: 780,
    size: 72844,
    width: 780
  },
  "/demo-assets/general/products/everyday-tote-bag-2.webp": {
    height: 918,
    size: 45600,
    width: 918
  },
  "/demo-assets/general/products/fast-charge-power-bank-1.webp": {
    height: 780,
    size: 18740,
    width: 780
  },
  "/demo-assets/general/products/fast-charge-power-bank-2.webp": {
    height: 781,
    size: 16650,
    width: 781
  },
  "/demo-assets/general/products/flex-training-bottle-1.webp": {
    height: 774,
    size: 33686,
    width: 774
  },
  "/demo-assets/general/products/flex-training-bottle-2.webp": {
    height: 780,
    size: 40946,
    width: 780
  },
  "/demo-assets/general/products/foldable-storage-basket-1.webp": {
    height: 780,
    size: 31250,
    width: 780
  },
  "/demo-assets/general/products/foldable-storage-basket-2.webp": {
    height: 780,
    size: 26162,
    width: 780
  },
  "/demo-assets/general/products/gel-pen-set-of-10-1.webp": {
    height: 780,
    size: 27268,
    width: 780
  },
  "/demo-assets/general/products/gel-pen-set-of-10-2.webp": {
    height: 780,
    size: 16744,
    width: 780
  },
  "/demo-assets/general/products/insulated-lunch-container-1.webp": {
    height: 780,
    size: 28648,
    width: 780
  },
  "/demo-assets/general/products/insulated-lunch-container-2.webp": {
    height: 780,
    size: 29760,
    width: 780
  },
  "/demo-assets/general/products/insulated-travel-mug-1.webp": {
    height: 780,
    size: 6820,
    width: 780
  },
  "/demo-assets/general/products/insulated-travel-mug-2.webp": {
    height: 918,
    size: 12278,
    width: 918
  },
  "/demo-assets/general/products/non-slip-yoga-mat-1.webp": {
    height: 780,
    size: 32102,
    width: 780
  },
  "/demo-assets/general/products/non-slip-yoga-mat-2.webp": {
    height: 919,
    size: 24958,
    width: 919
  },
  "/demo-assets/general/products/nova-wireless-headphones-1.webp": {
    height: 1365,
    size: 79428,
    width: 1365
  },
  "/demo-assets/general/products/nova-wireless-headphones-2.webp": {
    height: 1365,
    size: 56176,
    width: 1365
  },
  "/demo-assets/general/products/pocket-led-speaker-1.webp": {
    height: 780,
    size: 13656,
    width: 780
  },
  "/demo-assets/general/products/pocket-led-speaker-2.webp": {
    height: 780,
    size: 79790,
    width: 780
  },
  "/demo-assets/general/products/resistance-band-set-1.webp": {
    height: 781,
    size: 76898,
    width: 781
  },
  "/demo-assets/general/products/resistance-band-set-2.webp": {
    height: 781,
    size: 77008,
    width: 781
  },
  "/demo-assets/general/products/slim-card-wallet-1.webp": { height: 780, size: 33222, width: 780 },
  "/demo-assets/general/products/slim-card-wallet-2.webp": { height: 918, size: 85294, width: 918 },
  "/demo-assets/general/products/smooth-writing-notebook-set-1.webp": {
    height: 947,
    size: 15780,
    width: 947
  },
  "/demo-assets/general/products/smooth-writing-notebook-set-2.webp": {
    height: 957,
    size: 13294,
    width: 957
  },
  "/demo-assets/general/products/stainless-steel-kettle-1.webp": {
    height: 876,
    size: 18986,
    width: 876
  },
  "/demo-assets/general/products/stainless-steel-kettle-2.webp": {
    height: 803,
    size: 14134,
    width: 803
  },
  "/demo-assets/general/products/warm-knit-throw-blanket-1.webp": {
    height: 816,
    size: 87572,
    width: 816
  },
  "/demo-assets/general/products/warm-knit-throw-blanket-2.webp": {
    height: 775,
    size: 110528,
    width: 775
  },
  "/demo-assets/general/products/wireless-charging-pad-1.webp": {
    height: 780,
    size: 7560,
    width: 780
  },
  "/demo-assets/general/products/wireless-charging-pad-2.webp": {
    height: 780,
    size: 10130,
    width: 780
  }
};

/**
 * The hero and promo art. Unlike categories, brands and products these are not
 * attached to a catalogue record, so they are listed explicitly - importing puts
 * them in the library where the seller can point a section at them.
 */
const standaloneAssets: Array<{
  alt: string;
  url: string;
  usageType: DemoPackMediaAsset["usageType"];
}> = [
  {
    alt: "Everyday essentials for home, work and travel - hero slide",
    url: "/demo-assets/general/hero/hero-01.webp",
    usageType: "HERO"
  },
  {
    alt: "Practical tech that earns its place in your bag - hero slide",
    url: "/demo-assets/general/hero/hero-02.webp",
    usageType: "HERO"
  },
  {
    alt: "Small upgrades you notice every single day - hero slide",
    url: "/demo-assets/general/hero/hero-03.webp",
    usageType: "HERO"
  },
  {
    alt: "General store hero artwork cropped for narrow screens",
    url: "/demo-assets/general/hero/hero-mobile.webp",
    usageType: "HERO"
  },
  {
    alt: "Promotional banner for the full product catalogue",
    url: "/demo-assets/general/banners/promo-primary.webp",
    usageType: "GENERAL"
  },
  {
    alt: "Secondary promotional banner for seasonal offers",
    url: "/demo-assets/general/banners/promo-secondary.webp",
    usageType: "GENERAL"
  }
];

/**
 * Every image the pack references, as Media Library rows. Built from the same
 * category, brand and product arrays the catalogue is seeded from, so the
 * library can never drift out of sync with what the storefront renders.
 */
export const generalDemoMedia: DemoPackMediaAsset[] = [
  ...standaloneAssets.map((asset) => assetFor(asset.url, asset.alt, asset.usageType)),
  ...generalDemoCategories.flatMap((category) =>
    category.imageUrl
      ? [
          assetFor(
            category.imageUrl,
            category.imageAlt ?? `${category.name} category image`,
            "CATEGORY"
          )
        ]
      : []
  ),
  ...generalDemoBrands.flatMap((brand) =>
    brand.imageUrl
      ? [assetFor(brand.imageUrl, brand.imageAlt ?? `${brand.name} brand logo`, "GENERAL")]
      : []
  ),
  ...generalDemoProducts.flatMap((product) =>
    (product.images ?? [{ alt: product.imageAlt, url: product.imageUrl }]).map((image) =>
      assetFor(image.url, image.alt, "PRODUCT")
    )
  )
];

function assetFor(
  url: string,
  alt: string,
  usageType: DemoPackMediaAsset["usageType"]
): DemoPackMediaAsset {
  const metrics = fileMetrics[url];

  if (!metrics) {
    throw new Error(`General demo asset "${url}" is missing from the media metrics table.`);
  }

  return {
    alt,
    filename: url.slice(url.lastIndexOf("/") + 1),
    height: metrics.height,
    // The storage key doubles as the per-store uniqueness key, so it is the
    // public path without its leading slash - stable across re-imports.
    key: url.replace(/^\//, ""),
    mimeType: "image/webp",
    size: metrics.size,
    url,
    usageType,
    width: metrics.width
  };
}
