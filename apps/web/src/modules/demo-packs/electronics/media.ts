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
 * These describe the real product photography shipped with the pack, so the
 * sizes and aspect ratios vary per file rather than following a fixed grid.
 */
const fileMetrics: Record<string, { height: number; size: number; width: number }> = {
  "/demo-assets/electronics/banners/promo-primary.webp": { height: 960, size: 108052, width: 2560 },
  "/demo-assets/electronics/banners/promo-secondary.webp": {
    height: 1125,
    size: 83818,
    width: 3000
  },
  "/demo-assets/electronics/brands/auralis.webp": { height: 1024, size: 57064, width: 2048 },
  "/demo-assets/electronics/brands/cellgrip.webp": { height: 1024, size: 15256, width: 2048 },
  "/demo-assets/electronics/brands/fitpulse.webp": { height: 1024, size: 34298, width: 2048 },
  "/demo-assets/electronics/brands/lumio.webp": { height: 1024, size: 39838, width: 2048 },
  "/demo-assets/electronics/brands/nexcore.webp": { height: 965, size: 179582, width: 1930 },
  "/demo-assets/electronics/brands/pulsewave.webp": { height: 1024, size: 25586, width: 2048 },
  "/demo-assets/electronics/brands/raventek.webp": { height: 1024, size: 52334, width: 2048 },
  "/demo-assets/electronics/brands/typeline.webp": { height: 1024, size: 78092, width: 2048 },
  "/demo-assets/electronics/brands/voltix.webp": { height: 1024, size: 20092, width: 2048 },
  "/demo-assets/electronics/categories/audio.webp": { height: 781, size: 30826, width: 781 },
  "/demo-assets/electronics/categories/computing.webp": { height: 1044, size: 66738, width: 1044 },
  "/demo-assets/electronics/categories/gaming.webp": { height: 780, size: 35762, width: 780 },
  "/demo-assets/electronics/categories/home-tech.webp": { height: 780, size: 31814, width: 780 },
  "/demo-assets/electronics/categories/mobile-accessories.webp": {
    height: 880,
    size: 28634,
    width: 880
  },
  "/demo-assets/electronics/categories/wearables.webp": { height: 732, size: 18246, width: 732 },
  "/demo-assets/electronics/hero/hero-01.webp": { height: 1000, size: 173536, width: 2400 },
  "/demo-assets/electronics/hero/hero-02.webp": { height: 775, size: 25272, width: 1860 },
  "/demo-assets/electronics/hero/hero-03.webp": { height: 947, size: 111746, width: 2272 },
  "/demo-assets/electronics/hero/hero-mobile.webp": { height: 1218, size: 65190, width: 914 },
  "/demo-assets/electronics/products/14-inch-laptop-1.webp": {
    height: 780,
    size: 8798,
    width: 780
  },
  "/demo-assets/electronics/products/14-inch-laptop-2.webp": {
    height: 780,
    size: 21678,
    width: 780
  },
  "/demo-assets/electronics/products/24-inch-led-monitor-1.webp": {
    height: 781,
    size: 23300,
    width: 781
  },
  "/demo-assets/electronics/products/24-inch-led-monitor-2.webp": {
    height: 780,
    size: 18896,
    width: 780
  },
  "/demo-assets/electronics/products/bluetooth-speaker-1.webp": {
    height: 780,
    size: 50372,
    width: 780
  },
  "/demo-assets/electronics/products/bluetooth-speaker-2.webp": {
    height: 806,
    size: 54112,
    width: 806
  },
  "/demo-assets/electronics/products/dual-band-wifi-router-1.webp": {
    height: 917,
    size: 24242,
    width: 917
  },
  "/demo-assets/electronics/products/dual-band-wifi-router-2.webp": {
    height: 917,
    size: 22362,
    width: 917
  },
  "/demo-assets/electronics/products/fitness-tracker-band-1.webp": {
    height: 880,
    size: 65280,
    width: 880
  },
  "/demo-assets/electronics/products/fitness-tracker-band-2.webp": {
    height: 780,
    size: 19400,
    width: 780
  },
  "/demo-assets/electronics/products/gaming-headset-1.webp": {
    height: 780,
    size: 35040,
    width: 780
  },
  "/demo-assets/electronics/products/gaming-headset-2.webp": {
    height: 780,
    size: 45312,
    width: 780
  },
  "/demo-assets/electronics/products/hd-webcam-1.webp": { height: 777, size: 11568, width: 777 },
  "/demo-assets/electronics/products/hd-webcam-2.webp": { height: 918, size: 51758, width: 918 },
  "/demo-assets/electronics/products/home-security-camera-1.webp": {
    height: 780,
    size: 7626,
    width: 780
  },
  "/demo-assets/electronics/products/home-security-camera-2.webp": {
    height: 780,
    size: 11504,
    width: 780
  },
  "/demo-assets/electronics/products/kids-smartwatch-1.webp": {
    height: 780,
    size: 13208,
    width: 780
  },
  "/demo-assets/electronics/products/kids-smartwatch-2.webp": {
    height: 780,
    size: 17678,
    width: 780
  },
  "/demo-assets/electronics/products/over-ear-headphones-1.webp": {
    height: 764,
    size: 11302,
    width: 764
  },
  "/demo-assets/electronics/products/over-ear-headphones-2.webp": {
    height: 880,
    size: 11432,
    width: 880
  },
  "/demo-assets/electronics/products/phone-case-1.webp": { height: 687, size: 21906, width: 687 },
  "/demo-assets/electronics/products/phone-case-2.webp": { height: 880, size: 35902, width: 880 },
  "/demo-assets/electronics/products/power-bank-1.webp": { height: 780, size: 12098, width: 780 },
  "/demo-assets/electronics/products/power-bank-2.webp": { height: 780, size: 11050, width: 780 },
  "/demo-assets/electronics/products/rgb-gaming-mouse-1.webp": {
    height: 949,
    size: 28610,
    width: 949
  },
  "/demo-assets/electronics/products/rgb-gaming-mouse-2.webp": {
    height: 780,
    size: 12222,
    width: 780
  },
  "/demo-assets/electronics/products/rgb-mechanical-keyboard-1.webp": {
    height: 918,
    size: 32424,
    width: 918
  },
  "/demo-assets/electronics/products/rgb-mechanical-keyboard-2.webp": {
    height: 780,
    size: 24352,
    width: 780
  },
  "/demo-assets/electronics/products/smart-led-bulb-1.webp": {
    height: 780,
    size: 19232,
    width: 780
  },
  "/demo-assets/electronics/products/smart-led-bulb-2.webp": {
    height: 812,
    size: 20284,
    width: 812
  },
  "/demo-assets/electronics/products/smart-plug-1.webp": { height: 814, size: 7602, width: 814 },
  "/demo-assets/electronics/products/smart-plug-2.webp": { height: 780, size: 6940, width: 780 },
  "/demo-assets/electronics/products/smartwatch-1.webp": { height: 780, size: 20038, width: 780 },
  "/demo-assets/electronics/products/smartwatch-2.webp": { height: 780, size: 21808, width: 780 },
  "/demo-assets/electronics/products/smartwatch-silicone-strap-1.webp": {
    height: 786,
    size: 6878,
    width: 786
  },
  "/demo-assets/electronics/products/smartwatch-silicone-strap-2.webp": {
    height: 687,
    size: 9734,
    width: 687
  },
  "/demo-assets/electronics/products/soundbar-for-tv-1.webp": {
    height: 918,
    size: 59598,
    width: 918
  },
  "/demo-assets/electronics/products/soundbar-for-tv-2.webp": {
    height: 918,
    size: 47188,
    width: 918
  },
  "/demo-assets/electronics/products/usb-c-cable-1.webp": { height: 788, size: 13264, width: 788 },
  "/demo-assets/electronics/products/usb-c-cable-2.webp": { height: 788, size: 19242, width: 788 },
  "/demo-assets/electronics/products/wireless-charging-pad-1.webp": {
    height: 780,
    size: 7664,
    width: 780
  },
  "/demo-assets/electronics/products/wireless-charging-pad-2.webp": {
    height: 1365,
    size: 20520,
    width: 1365
  },
  "/demo-assets/electronics/products/wireless-earbuds-1.webp": {
    height: 918,
    size: 18876,
    width: 918
  },
  "/demo-assets/electronics/products/wireless-earbuds-2.webp": {
    height: 683,
    size: 9262,
    width: 683
  },
  "/demo-assets/electronics/products/wireless-game-controller-1.webp": {
    height: 781,
    size: 11006,
    width: 781
  },
  "/demo-assets/electronics/products/wireless-game-controller-2.webp": {
    height: 764,
    size: 26256,
    width: 764
  },
  "/demo-assets/electronics/products/wireless-mouse-1.webp": {
    height: 819,
    size: 5452,
    width: 819
  },
  "/demo-assets/electronics/products/wireless-mouse-2.webp": {
    height: 780,
    size: 12116,
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
