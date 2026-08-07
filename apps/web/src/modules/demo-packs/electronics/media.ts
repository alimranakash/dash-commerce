import type { DemoPackMediaAsset } from "../types";
import { electronicsDemoBrands } from "./brands";
import { electronicsDemoCategories } from "./categories";
import { electronicsDemoProducts } from "./products";

/**
 * Byte size and pixel dimensions of every file under
 * apps/web/public/demo-assets/electronics/, measured from the committed images.
 *
 * MediaAsset.size is a required column and width/height drive the library grid,
 * so the numbers are baked in here rather than stat-ed while an import runs -
 * seeding never touches the filesystem. Re-measure this table if an image is
 * replaced; `assetFor` throws on a path that is missing from it, which surfaces
 * the drift immediately instead of writing a zero-byte row.
 *
 * These currently describe the generated placeholders. Swapping in real photos
 * means updating both the file and its row here.
 */
const fileMetrics: Record<string, { height: number; size: number; width: number }> = {
  "/demo-assets/electronics/banners/promo-primary.webp": { height: 600, size: 5892, width: 1600 },
  "/demo-assets/electronics/banners/promo-secondary.webp": { height: 600, size: 6532, width: 1600 },
  "/demo-assets/electronics/brands/auralis.webp": { height: 200, size: 786, width: 400 },
  "/demo-assets/electronics/brands/cellgrip.webp": { height: 200, size: 848, width: 400 },
  "/demo-assets/electronics/brands/fitpulse.webp": { height: 200, size: 840, width: 400 },
  "/demo-assets/electronics/brands/lumio.webp": { height: 200, size: 752, width: 400 },
  "/demo-assets/electronics/brands/nexcore.webp": { height: 200, size: 884, width: 400 },
  "/demo-assets/electronics/brands/pulsewave.webp": { height: 200, size: 946, width: 400 },
  "/demo-assets/electronics/brands/raventek.webp": { height: 200, size: 906, width: 400 },
  "/demo-assets/electronics/brands/typeline.webp": { height: 200, size: 872, width: 400 },
  "/demo-assets/electronics/brands/voltix.webp": { height: 200, size: 764, width: 400 },
  "/demo-assets/electronics/categories/audio.webp": { height: 800, size: 3346, width: 800 },
  "/demo-assets/electronics/categories/computing.webp": { height: 800, size: 4530, width: 800 },
  "/demo-assets/electronics/categories/gaming.webp": { height: 800, size: 4002, width: 800 },
  "/demo-assets/electronics/categories/home-tech.webp": { height: 800, size: 4030, width: 800 },
  "/demo-assets/electronics/categories/mobile-accessories.webp": {
    height: 800,
    size: 6470,
    width: 800
  },
  "/demo-assets/electronics/categories/wearables.webp": { height: 800, size: 5012, width: 800 },
  "/demo-assets/electronics/hero/hero-01.webp": { height: 1000, size: 11028, width: 2400 },
  "/demo-assets/electronics/hero/hero-02.webp": { height: 1000, size: 9746, width: 2400 },
  "/demo-assets/electronics/hero/hero-03.webp": { height: 1000, size: 9086, width: 2400 },
  "/demo-assets/electronics/hero/hero-mobile.webp": { height: 1200, size: 8380, width: 900 },
  "/demo-assets/electronics/products/14-inch-laptop-1.webp": {
    height: 1200,
    size: 8704,
    width: 1200
  },
  "/demo-assets/electronics/products/14-inch-laptop-2.webp": {
    height: 1200,
    size: 7942,
    width: 1200
  },
  "/demo-assets/electronics/products/24-inch-led-monitor-1.webp": {
    height: 1200,
    size: 9840,
    width: 1200
  },
  "/demo-assets/electronics/products/24-inch-led-monitor-2.webp": {
    height: 1200,
    size: 9030,
    width: 1200
  },
  "/demo-assets/electronics/products/bluetooth-speaker-1.webp": {
    height: 1200,
    size: 9288,
    width: 1200
  },
  "/demo-assets/electronics/products/bluetooth-speaker-2.webp": {
    height: 1200,
    size: 9092,
    width: 1200
  },
  "/demo-assets/electronics/products/dual-band-wifi-router-1.webp": {
    height: 1200,
    size: 10310,
    width: 1200
  },
  "/demo-assets/electronics/products/dual-band-wifi-router-2.webp": {
    height: 1200,
    size: 9852,
    width: 1200
  },
  "/demo-assets/electronics/products/fitness-tracker-band-1.webp": {
    height: 1200,
    size: 10824,
    width: 1200
  },
  "/demo-assets/electronics/products/fitness-tracker-band-2.webp": {
    height: 1200,
    size: 10748,
    width: 1200
  },
  "/demo-assets/electronics/products/gaming-headset-1.webp": {
    height: 1200,
    size: 9586,
    width: 1200
  },
  "/demo-assets/electronics/products/gaming-headset-2.webp": {
    height: 1200,
    size: 8780,
    width: 1200
  },
  "/demo-assets/electronics/products/hd-webcam-1.webp": { height: 1200, size: 8666, width: 1200 },
  "/demo-assets/electronics/products/hd-webcam-2.webp": { height: 1200, size: 7894, width: 1200 },
  "/demo-assets/electronics/products/home-security-camera-1.webp": {
    height: 1200,
    size: 10502,
    width: 1200
  },
  "/demo-assets/electronics/products/home-security-camera-2.webp": {
    height: 1200,
    size: 10170,
    width: 1200
  },
  "/demo-assets/electronics/products/kids-smartwatch-1.webp": {
    height: 1200,
    size: 10390,
    width: 1200
  },
  "/demo-assets/electronics/products/kids-smartwatch-2.webp": {
    height: 1200,
    size: 10220,
    width: 1200
  },
  "/demo-assets/electronics/products/over-ear-headphones-1.webp": {
    height: 1200,
    size: 9902,
    width: 1200
  },
  "/demo-assets/electronics/products/over-ear-headphones-2.webp": {
    height: 1200,
    size: 9706,
    width: 1200
  },
  "/demo-assets/electronics/products/phone-case-1.webp": { height: 1200, size: 9124, width: 1200 },
  "/demo-assets/electronics/products/phone-case-2.webp": { height: 1200, size: 8930, width: 1200 },
  "/demo-assets/electronics/products/power-bank-1.webp": { height: 1200, size: 9284, width: 1200 },
  "/demo-assets/electronics/products/power-bank-2.webp": { height: 1200, size: 9164, width: 1200 },
  "/demo-assets/electronics/products/rgb-gaming-mouse-1.webp": {
    height: 1200,
    size: 10386,
    width: 1200
  },
  "/demo-assets/electronics/products/rgb-gaming-mouse-2.webp": {
    height: 1200,
    size: 9656,
    width: 1200
  },
  "/demo-assets/electronics/products/rgb-mechanical-keyboard-1.webp": {
    height: 1200,
    size: 12402,
    width: 1200
  },
  "/demo-assets/electronics/products/rgb-mechanical-keyboard-2.webp": {
    height: 1200,
    size: 11630,
    width: 1200
  },
  "/demo-assets/electronics/products/smart-led-bulb-1.webp": {
    height: 1200,
    size: 8080,
    width: 1200
  },
  "/demo-assets/electronics/products/smart-led-bulb-2.webp": {
    height: 1200,
    size: 7750,
    width: 1200
  },
  "/demo-assets/electronics/products/smart-plug-1.webp": { height: 1200, size: 7304, width: 1200 },
  "/demo-assets/electronics/products/smart-plug-2.webp": { height: 1200, size: 7060, width: 1200 },
  "/demo-assets/electronics/products/smartwatch-1.webp": { height: 1200, size: 8904, width: 1200 },
  "/demo-assets/electronics/products/smartwatch-2.webp": { height: 1200, size: 8788, width: 1200 },
  "/demo-assets/electronics/products/smartwatch-silicone-strap-1.webp": {
    height: 1200,
    size: 13064,
    width: 1200
  },
  "/demo-assets/electronics/products/smartwatch-silicone-strap-2.webp": {
    height: 1200,
    size: 12952,
    width: 1200
  },
  "/demo-assets/electronics/products/soundbar-for-tv-1.webp": {
    height: 1200,
    size: 8450,
    width: 1200
  },
  "/demo-assets/electronics/products/soundbar-for-tv-2.webp": {
    height: 1200,
    size: 8266,
    width: 1200
  },
  "/demo-assets/electronics/products/usb-c-cable-1.webp": { height: 1200, size: 9362, width: 1200 },
  "/demo-assets/electronics/products/usb-c-cable-2.webp": { height: 1200, size: 9158, width: 1200 },
  "/demo-assets/electronics/products/wireless-charging-pad-1.webp": {
    height: 1200,
    size: 12560,
    width: 1200
  },
  "/demo-assets/electronics/products/wireless-charging-pad-2.webp": {
    height: 1200,
    size: 12372,
    width: 1200
  },
  "/demo-assets/electronics/products/wireless-earbuds-1.webp": {
    height: 1200,
    size: 9112,
    width: 1200
  },
  "/demo-assets/electronics/products/wireless-earbuds-2.webp": {
    height: 1200,
    size: 8920,
    width: 1200
  },
  "/demo-assets/electronics/products/wireless-game-controller-1.webp": {
    height: 1200,
    size: 11960,
    width: 1200
  },
  "/demo-assets/electronics/products/wireless-game-controller-2.webp": {
    height: 1200,
    size: 11196,
    width: 1200
  },
  "/demo-assets/electronics/products/wireless-mouse-1.webp": {
    height: 1200,
    size: 9916,
    width: 1200
  },
  "/demo-assets/electronics/products/wireless-mouse-2.webp": {
    height: 1200,
    size: 9088,
    width: 1200
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
    alt: "New season electronics - hero slide",
    url: "/demo-assets/electronics/hero/hero-01.webp",
    usageType: "HERO"
  },
  {
    alt: "Audio and wearables that travel with you - hero slide",
    url: "/demo-assets/electronics/hero/hero-02.webp",
    usageType: "HERO"
  },
  {
    alt: "Build a desk that works and plays - hero slide",
    url: "/demo-assets/electronics/hero/hero-03.webp",
    usageType: "HERO"
  },
  {
    alt: "Electronics hero artwork cropped for narrow screens",
    url: "/demo-assets/electronics/hero/hero-mobile.webp",
    usageType: "HERO"
  },
  {
    alt: "Promotional banner for the full electronics catalogue",
    url: "/demo-assets/electronics/banners/promo-primary.webp",
    usageType: "GENERAL"
  },
  {
    alt: "Secondary promotional banner for smart home essentials",
    url: "/demo-assets/electronics/banners/promo-secondary.webp",
    usageType: "GENERAL"
  }
];

/**
 * Every image the pack references, as Media Library rows. Built from the same
 * category, brand and product arrays the catalogue is seeded from, so the
 * library can never drift out of sync with what the storefront renders.
 */
export const electronicsDemoMedia: DemoPackMediaAsset[] = [
  ...standaloneAssets.map((asset) => assetFor(asset.url, asset.alt, asset.usageType)),
  ...electronicsDemoCategories.flatMap((category) =>
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
  ...electronicsDemoBrands.flatMap((brand) =>
    brand.imageUrl
      ? [assetFor(brand.imageUrl, brand.imageAlt ?? `${brand.name} brand logo`, "GENERAL")]
      : []
  ),
  ...electronicsDemoProducts.flatMap((product) =>
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
    throw new Error(`Electronics demo asset "${url}" is missing from the media metrics table.`);
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
