import type { DemoPackMediaAsset } from "../types";
import { fashionDemoBrands } from "./brands";
import { fashionDemoCategories } from "./categories";
import { fashionDemoProducts } from "./products";

/**
 * Byte size and pixel dimensions of every file under
 * apps/web/public/demo-assets/fashion/, measured from the committed images.
 *
 * MediaAsset.size is a required column and width/height drive the library grid,
 * so the numbers are baked in here rather than stat-ed while an import runs -
 * seeding never touches the filesystem. Re-measure this table if an image is
 * replaced; `assetFor` throws on a path that is missing from it, which surfaces
 * the drift immediately instead of writing a zero-byte row.
 *
 * These describe the real fashion photography shipped with the pack, so the
 * sizes and aspect ratios vary per file rather than following a fixed grid.
 */
const fileMetrics: Record<string, { height: number; size: number; width: number }> = {
  "/demo-assets/fashion/banners/promo-primary.webp": { height: 825, size: 76268, width: 2200 },
  "/demo-assets/fashion/banners/promo-secondary.webp": { height: 578, size: 41708, width: 1542 },
  "/demo-assets/fashion/brands/auriva.webp": { height: 1024, size: 37246, width: 2048 },
  "/demo-assets/fashion/brands/carryall.webp": { height: 396, size: 31366, width: 791 },
  "/demo-assets/fashion/brands/denim-co.webp": { height: 768, size: 118064, width: 1536 },
  "/demo-assets/fashion/brands/northloom.webp": { height: 1024, size: 155376, width: 2048 },
  "/demo-assets/fashion/brands/solestep.webp": { height: 1024, size: 251456, width: 2048 },
  "/demo-assets/fashion/brands/stridewell.webp": { height: 1024, size: 39718, width: 2048 },
  "/demo-assets/fashion/brands/sunhaven.webp": { height: 1024, size: 45242, width: 2048 },
  "/demo-assets/fashion/brands/urban-thread.webp": { height: 1024, size: 139402, width: 2048 },
  "/demo-assets/fashion/brands/velora.webp": { height: 1024, size: 21642, width: 2048 },
  "/demo-assets/fashion/categories/accessories.webp": { height: 799, size: 44880, width: 799 },
  "/demo-assets/fashion/categories/bags.webp": { height: 735, size: 37844, width: 735 },
  "/demo-assets/fashion/categories/footwear.webp": { height: 777, size: 189594, width: 777 },
  "/demo-assets/fashion/categories/jewelry.webp": { height: 780, size: 30998, width: 780 },
  "/demo-assets/fashion/categories/mens-clothing.webp": { height: 779, size: 38604, width: 779 },
  "/demo-assets/fashion/categories/womens-clothing.webp": { height: 711, size: 53120, width: 711 },
  "/demo-assets/fashion/hero/hero-01.webp": { height: 1333, size: 107492, width: 3200 },
  "/demo-assets/fashion/hero/hero-02.webp": { height: 680, size: 17064, width: 1632 },
  "/demo-assets/fashion/hero/hero-03.webp": { height: 640, size: 58130, width: 1536 },
  "/demo-assets/fashion/hero/hero-mobile.webp": { height: 1835, size: 50214, width: 1376 },
  "/demo-assets/fashion/products/analog-wristwatch-1.webp": {
    height: 780,
    size: 17142,
    width: 780
  },
  "/demo-assets/fashion/products/analog-wristwatch-2.webp": {
    height: 780,
    size: 21028,
    width: 780
  },
  "/demo-assets/fashion/products/ankle-boots-1.webp": { height: 776, size: 27192, width: 776 },
  "/demo-assets/fashion/products/ankle-boots-2.webp": { height: 780, size: 17370, width: 780 },
  "/demo-assets/fashion/products/aviator-sunglasses-1.webp": {
    height: 736,
    size: 12106,
    width: 736
  },
  "/demo-assets/fashion/products/aviator-sunglasses-2.webp": {
    height: 781,
    size: 37458,
    width: 781
  },
  "/demo-assets/fashion/products/baseball-cap-1.webp": { height: 735, size: 20800, width: 735 },
  "/demo-assets/fashion/products/baseball-cap-2.webp": { height: 687, size: 24482, width: 687 },
  "/demo-assets/fashion/products/canvas-tote-bag-1.webp": { height: 687, size: 10270, width: 687 },
  "/demo-assets/fashion/products/canvas-tote-bag-2.webp": { height: 780, size: 37582, width: 780 },
  "/demo-assets/fashion/products/charm-bracelet-1.webp": { height: 687, size: 12242, width: 687 },
  "/demo-assets/fashion/products/charm-bracelet-2.webp": { height: 687, size: 16526, width: 687 },
  "/demo-assets/fashion/products/cotton-kurti-1.webp": { height: 687, size: 30882, width: 687 },
  "/demo-assets/fashion/products/cotton-kurti-2.webp": { height: 735, size: 41590, width: 735 },
  "/demo-assets/fashion/products/cotton-t-shirt-1.webp": { height: 627, size: 9058, width: 627 },
  "/demo-assets/fashion/products/cotton-t-shirt-2.webp": { height: 687, size: 42888, width: 687 },
  "/demo-assets/fashion/products/crossbody-bag-1.webp": { height: 878, size: 17586, width: 878 },
  "/demo-assets/fashion/products/crossbody-bag-2.webp": { height: 674, size: 22960, width: 674 },
  "/demo-assets/fashion/products/denim-jacket-1.webp": { height: 728, size: 24548, width: 728 },
  "/demo-assets/fashion/products/denim-jacket-2.webp": { height: 780, size: 53514, width: 780 },
  "/demo-assets/fashion/products/denim-jeans-1.webp": { height: 687, size: 46558, width: 687 },
  "/demo-assets/fashion/products/denim-jeans-2.webp": { height: 687, size: 17876, width: 687 },
  "/demo-assets/fashion/products/formal-shirt-1.webp": { height: 726, size: 73624, width: 726 },
  "/demo-assets/fashion/products/formal-shirt-2.webp": { height: 764, size: 44508, width: 764 },
  "/demo-assets/fashion/products/gold-plated-necklace-1.webp": {
    height: 670,
    size: 13330,
    width: 670
  },
  "/demo-assets/fashion/products/gold-plated-necklace-2.webp": {
    height: 735,
    size: 27772,
    width: 735
  },
  "/demo-assets/fashion/products/knit-cardigan-1.webp": { height: 764, size: 53434, width: 764 },
  "/demo-assets/fashion/products/knit-cardigan-2.webp": { height: 764, size: 75546, width: 764 },
  "/demo-assets/fashion/products/laptop-backpack-1.webp": { height: 724, size: 30162, width: 724 },
  "/demo-assets/fashion/products/laptop-backpack-2.webp": { height: 691, size: 35366, width: 691 },
  "/demo-assets/fashion/products/leather-belt-1.webp": { height: 746, size: 34372, width: 746 },
  "/demo-assets/fashion/products/leather-belt-2.webp": { height: 629, size: 23212, width: 629 },
  "/demo-assets/fashion/products/leather-handbag-1.webp": { height: 880, size: 26040, width: 880 },
  "/demo-assets/fashion/products/leather-handbag-2.webp": { height: 716, size: 10950, width: 716 },
  "/demo-assets/fashion/products/leather-loafers-1.webp": { height: 687, size: 14216, width: 687 },
  "/demo-assets/fashion/products/leather-loafers-2.webp": { height: 687, size: 25968, width: 687 },
  "/demo-assets/fashion/products/leather-sandals-1.webp": { height: 806, size: 10320, width: 806 },
  "/demo-assets/fashion/products/leather-sandals-2.webp": { height: 687, size: 15086, width: 687 },
  "/demo-assets/fashion/products/leather-wallet-1.webp": { height: 687, size: 11382, width: 687 },
  "/demo-assets/fashion/products/leather-wallet-2.webp": { height: 764, size: 33124, width: 764 },
  "/demo-assets/fashion/products/pullover-hoodie-1.webp": { height: 806, size: 29732, width: 806 },
  "/demo-assets/fashion/products/pullover-hoodie-2.webp": { height: 688, size: 11072, width: 688 },
  "/demo-assets/fashion/products/running-sneakers-1.webp": { height: 765, size: 28860, width: 765 },
  "/demo-assets/fashion/products/running-sneakers-2.webp": { height: 781, size: 33034, width: 781 },
  "/demo-assets/fashion/products/silver-hoop-earrings-1.webp": {
    height: 880,
    size: 18984,
    width: 880
  },
  "/demo-assets/fashion/products/silver-hoop-earrings-2.webp": {
    height: 687,
    size: 22466,
    width: 687
  },
  "/demo-assets/fashion/products/summer-dress-1.webp": { height: 687, size: 38380, width: 687 },
  "/demo-assets/fashion/products/summer-dress-2.webp": { height: 664, size: 23132, width: 664 }
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
    alt: "Woman in a cream jacket with a shoulder bag - hero slide",
    url: "/demo-assets/fashion/hero/hero-01.webp",
    usageType: "HERO"
  },
  {
    alt: "Man in a burgundy blazer over a hooded layer - hero slide",
    url: "/demo-assets/fashion/hero/hero-02.webp",
    usageType: "HERO"
  },
  {
    alt: "Man in a corduroy blazer and roll neck on a city street - hero slide",
    url: "/demo-assets/fashion/hero/hero-03.webp",
    usageType: "HERO"
  },
  {
    alt: "Fashion hero artwork cropped for narrow screens",
    url: "/demo-assets/fashion/hero/hero-mobile.webp",
    usageType: "HERO"
  },
  {
    alt: "Promotional banner for the womenswear edit",
    url: "/demo-assets/fashion/banners/promo-primary.webp",
    usageType: "GENERAL"
  },
  {
    alt: "Secondary promotional banner for bags and leather goods",
    url: "/demo-assets/fashion/banners/promo-secondary.webp",
    usageType: "GENERAL"
  }
];

/**
 * Every image the pack references, as Media Library rows. Built from the same
 * category, brand and product arrays the catalogue is seeded from, so the
 * library can never drift out of sync with what the storefront renders.
 */
export const fashionDemoMedia: DemoPackMediaAsset[] = [
  ...standaloneAssets.map((asset) => assetFor(asset.url, asset.alt, asset.usageType)),
  ...fashionDemoCategories.flatMap((category) =>
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
  ...fashionDemoBrands.flatMap((brand) =>
    brand.imageUrl
      ? [assetFor(brand.imageUrl, brand.imageAlt ?? `${brand.name} brand logo`, "GENERAL")]
      : []
  ),
  ...fashionDemoProducts.flatMap((product) =>
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
    throw new Error(`Fashion demo asset "${url}" is missing from the media metrics table.`);
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
