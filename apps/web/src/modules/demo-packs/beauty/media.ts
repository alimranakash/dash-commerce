import type { DemoPackMediaAsset } from "../types";
import { beautyDemoBrands } from "./brands";
import { beautyDemoCategories } from "./categories";
import { beautyDemoProducts } from "./products";

/**
 * Byte size and pixel dimensions of every file under
 * apps/web/public/demo-assets/beauty/, measured from the committed images.
 *
 * MediaAsset.size is a required column and width/height drive the library grid,
 * so the numbers are baked in here rather than stat-ed while an import runs -
 * seeding never touches the filesystem. Re-measure this table if an image is
 * replaced; `assetFor` throws on a path that is missing from it, which surfaces
 * the drift immediately instead of writing a zero-byte row.
 *
 * These describe real beauty photography, so sizes and aspect ratios vary per
 * file - some packshots are cut out on transparent backgrounds and some are
 * shot on a set, which is deliberate and not something to normalise.
 */
const fileMetrics: Record<string, { height: number; size: number; width: number }> = {
  "/demo-assets/beauty/banners/promo-primary.webp": { height: 863, size: 111758, width: 2300 },
  "/demo-assets/beauty/banners/promo-secondary.webp": { height: 449, size: 22348, width: 1077 },
  "/demo-assets/beauty/brands/auralis.webp": { height: 450, size: 7746, width: 900 },
  "/demo-assets/beauty/brands/bare-bloom.webp": { height: 500, size: 9746, width: 1000 },
  "/demo-assets/beauty/brands/cocoon.webp": { height: 450, size: 3218, width: 900 },
  "/demo-assets/beauty/brands/dewline.webp": { height: 450, size: 3772, width: 900 },
  "/demo-assets/beauty/brands/lumen-skin.webp": { height: 450, size: 4574, width: 900 },
  "/demo-assets/beauty/brands/petalworks.webp": { height: 500, size: 4060, width: 1000 },
  "/demo-assets/beauty/brands/rosewood.webp": { height: 600, size: 8760, width: 1200 },
  "/demo-assets/beauty/brands/silkroot.webp": { height: 450, size: 6042, width: 900 },
  "/demo-assets/beauty/brands/vellora.webp": { height: 500, size: 15178, width: 1000 },
  "/demo-assets/beauty/categories/beauty-tools.webp": { height: 1000, size: 5568, width: 1000 },
  "/demo-assets/beauty/categories/bodycare.webp": { height: 450, size: 15360, width: 450 },
  "/demo-assets/beauty/categories/fragrance.webp": { height: 800, size: 6900, width: 800 },
  "/demo-assets/beauty/categories/haircare.webp": { height: 450, size: 24506, width: 450 },
  "/demo-assets/beauty/categories/makeup.webp": { height: 1000, size: 10776, width: 1000 },
  "/demo-assets/beauty/categories/skincare.webp": { height: 450, size: 6420, width: 450 },
  "/demo-assets/beauty/hero/hero-01.webp": { height: 1200, size: 68838, width: 2880 },
  "/demo-assets/beauty/hero/hero-02.webp": { height: 1270, size: 110610, width: 3048 },
  "/demo-assets/beauty/hero/hero-03.webp": { height: 763, size: 39862, width: 1831 },
  "/demo-assets/beauty/hero/hero-mobile.webp": { height: 1018, size: 31130, width: 764 },
  "/demo-assets/beauty/products/advanced-anti-aging-serum-1.webp": {
    height: 1200,
    size: 20318,
    width: 1200
  },
  "/demo-assets/beauty/products/advanced-anti-aging-serum-2.webp": {
    height: 1200,
    size: 9752,
    width: 1200
  },
  "/demo-assets/beauty/products/argan-hair-oil-1.webp": { height: 900, size: 12660, width: 900 },
  "/demo-assets/beauty/products/argan-hair-oil-2.webp": { height: 900, size: 50668, width: 900 },
  "/demo-assets/beauty/products/beauty-blender-sponge-1.webp": {
    height: 500,
    size: 12264,
    width: 500
  },
  "/demo-assets/beauty/products/beauty-blender-sponge-2.webp": {
    height: 500,
    size: 26350,
    width: 500
  },
  "/demo-assets/beauty/products/botanical-bliss-shampoo-1.webp": {
    height: 1200,
    size: 43672,
    width: 1200
  },
  "/demo-assets/beauty/products/botanical-bliss-shampoo-2.webp": {
    height: 1200,
    size: 47646,
    width: 1200
  },
  "/demo-assets/beauty/products/botanical-body-cream-1.webp": {
    height: 500,
    size: 7222,
    width: 500
  },
  "/demo-assets/beauty/products/botanical-body-cream-2.webp": {
    height: 500,
    size: 12426,
    width: 500
  },
  "/demo-assets/beauty/products/botanicare-face-cream-1.webp": {
    height: 800,
    size: 122714,
    width: 800
  },
  "/demo-assets/beauty/products/botanicare-face-cream-2.webp": {
    height: 448,
    size: 5990,
    width: 448
  },
  "/demo-assets/beauty/products/clear-spf50-sunscreen-1.webp": {
    height: 900,
    size: 5480,
    width: 900
  },
  "/demo-assets/beauty/products/clear-spf50-sunscreen-2.webp": {
    height: 900,
    size: 35222,
    width: 900
  },
  "/demo-assets/beauty/products/color-mascara-1.webp": { height: 2048, size: 34250, width: 2048 },
  "/demo-assets/beauty/products/color-mascara-2.webp": { height: 2048, size: 38222, width: 2048 },
  "/demo-assets/beauty/products/compact-powder-1.webp": { height: 1000, size: 14984, width: 1000 },
  "/demo-assets/beauty/products/compact-powder-2.webp": { height: 1000, size: 23194, width: 1000 },
  "/demo-assets/beauty/products/crystalglow-body-essence-1.webp": {
    height: 1200,
    size: 25730,
    width: 1200
  },
  "/demo-assets/beauty/products/crystalglow-body-essence-2.webp": {
    height: 448,
    size: 13114,
    width: 448
  },
  "/demo-assets/beauty/products/detox-shampoo-1.webp": { height: 900, size: 5842, width: 900 },
  "/demo-assets/beauty/products/detox-shampoo-2.webp": { height: 900, size: 5742, width: 900 },
  "/demo-assets/beauty/products/eau-de-parfum-1.webp": { height: 412, size: 6866, width: 412 },
  "/demo-assets/beauty/products/eau-de-parfum-2.webp": { height: 439, size: 3660, width: 439 },
  "/demo-assets/beauty/products/glacial-coast-detox-masque-1.webp": {
    height: 800,
    size: 10774,
    width: 800
  },
  "/demo-assets/beauty/products/glacial-coast-detox-masque-2.webp": {
    height: 800,
    size: 18640,
    width: 800
  },
  "/demo-assets/beauty/products/halo-highlighter-1.webp": {
    height: 2048,
    size: 61604,
    width: 2048
  },
  "/demo-assets/beauty/products/halo-highlighter-2.webp": {
    height: 1365,
    size: 60622,
    width: 1365
  },
  "/demo-assets/beauty/products/honey-protein-mask-1.webp": { height: 900, size: 5302, width: 900 },
  "/demo-assets/beauty/products/honey-protein-mask-2.webp": { height: 900, size: 8926, width: 900 },
  "/demo-assets/beauty/products/hydrating-face-lotion-1.webp": {
    height: 448,
    size: 3346,
    width: 448
  },
  "/demo-assets/beauty/products/hydrating-face-lotion-2.webp": {
    height: 448,
    size: 5528,
    width: 448
  },
  "/demo-assets/beauty/products/lip-pencil-1.webp": { height: 900, size: 4152, width: 900 },
  "/demo-assets/beauty/products/lip-pencil-2.webp": { height: 900, size: 39010, width: 900 },
  "/demo-assets/beauty/products/luxury-red-lipstick-1.webp": {
    height: 1200,
    size: 14264,
    width: 1200
  },
  "/demo-assets/beauty/products/luxury-red-lipstick-2.webp": {
    height: 1200,
    size: 13404,
    width: 1200
  },
  "/demo-assets/beauty/products/mint-clay-hair-mask-1.webp": {
    height: 900,
    size: 6696,
    width: 900
  },
  "/demo-assets/beauty/products/mint-clay-hair-mask-2.webp": {
    height: 900,
    size: 12958,
    width: 900
  },
  "/demo-assets/beauty/products/radiant-touch-concealer-1.webp": {
    height: 2048,
    size: 22620,
    width: 2048
  },
  "/demo-assets/beauty/products/radiant-touch-concealer-2.webp": {
    height: 1365,
    size: 11798,
    width: 1365
  },
  "/demo-assets/beauty/products/shiny-lip-gloss-1.webp": { height: 900, size: 8112, width: 900 },
  "/demo-assets/beauty/products/shiny-lip-gloss-2.webp": { height: 900, size: 12396, width: 900 },
  "/demo-assets/beauty/products/vegan-mascara-1.webp": { height: 900, size: 4810, width: 900 },
  "/demo-assets/beauty/products/vegan-mascara-2.webp": { height: 900, size: 31554, width: 900 },
  "/demo-assets/beauty/products/vitamin-e-ceramide-serum-1.webp": {
    height: 2000,
    size: 16706,
    width: 2000
  },
  "/demo-assets/beauty/products/vitamin-e-ceramide-serum-2.webp": {
    height: 1200,
    size: 21884,
    width: 1200
  },
  "/demo-assets/beauty/products/volumizing-hair-mask-1.webp": {
    height: 432,
    size: 5878,
    width: 432
  },
  "/demo-assets/beauty/products/volumizing-hair-mask-2.webp": {
    height: 432,
    size: 4050,
    width: 432
  },
  "/demo-assets/beauty/results/after-01.webp": { height: 792, size: 123032, width: 1500 },
  "/demo-assets/beauty/results/before-01.webp": { height: 1600, size: 523270, width: 3840 }
};

/**
 * Hero art, campaign banners and the two comparison frames. Unlike categories,
 * brands and products these are not attached to a catalogue record, so they are
 * listed explicitly - importing puts them in the library where the seller can
 * point a section at them.
 */
const standaloneAssets: Array<{
  alt: string;
  url: string;
  usageType: DemoPackMediaAsset["usageType"];
}> = [
  {
    alt: "Three women together against a warm backdrop - hero slide",
    url: "/demo-assets/beauty/hero/hero-01.webp",
    usageType: "HERO"
  },
  {
    alt: "Two women photographed close up in daylight - hero slide",
    url: "/demo-assets/beauty/hero/hero-02.webp",
    usageType: "HERO"
  },
  {
    alt: "Three women holding skincare jars against a white wall - hero slide",
    url: "/demo-assets/beauty/hero/hero-03.webp",
    usageType: "HERO"
  },
  {
    alt: "Woman holding an open cream jar, cropped for narrow screens",
    url: "/demo-assets/beauty/hero/hero-mobile.webp",
    usageType: "HERO"
  },
  {
    alt: "Nude lipstick being applied, campaign banner",
    url: "/demo-assets/beauty/banners/promo-primary.webp",
    usageType: "GENERAL"
  },
  {
    alt: "Woman resting her hands against her face, campaign banner",
    url: "/demo-assets/beauty/banners/promo-secondary.webp",
    usageType: "GENERAL"
  },
  {
    alt: "Moisturiser campaign frame shot against a blue sky",
    url: "/demo-assets/beauty/results/before-01.webp",
    usageType: "GENERAL"
  },
  {
    alt: "Moisturiser campaign frame shot against a blush backdrop",
    url: "/demo-assets/beauty/results/after-01.webp",
    usageType: "GENERAL"
  }
];

/**
 * Every image the pack references, as Media Library rows. Built from the same
 * category, brand and product arrays the catalogue is seeded from, so the
 * library can never drift out of sync with what the storefront renders.
 */
export const beautyDemoMedia: DemoPackMediaAsset[] = [
  ...standaloneAssets.map((asset) => assetFor(asset.url, asset.alt, asset.usageType)),
  ...beautyDemoCategories.flatMap((category) =>
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
  ...beautyDemoBrands.flatMap((brand) =>
    brand.imageUrl
      ? [assetFor(brand.imageUrl, brand.imageAlt ?? `${brand.name} brand image`, "GENERAL")]
      : []
  ),
  ...beautyDemoProducts.flatMap((product) =>
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
    throw new Error(`Beauty demo asset "${url}" is missing from the media metrics table.`);
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
