import type { DemoPackBrand } from "../types";

/**
 * Nine house brands, one per image under apps/web/public/demo-assets/beauty/brands/.
 * The art is a wide product crop rather than a wordmark, so each brand is paired
 * with products that match the bottle in its own image.
 */
export const beautyDemoBrands = [
  {
    imageAlt: "Auralis argan hair oil held in one hand",
    imageUrl: "/demo-assets/beauty/brands/auralis.webp",
    name: "Auralis",
    slug: "auralis"
  },
  {
    imageAlt: "Bare Bloom lip pencil beside its swatch",
    imageUrl: "/demo-assets/beauty/brands/bare-bloom.webp",
    name: "Bare Bloom",
    slug: "bare-bloom"
  },
  {
    imageAlt: "Cocoon spray sunscreen bottle",
    imageUrl: "/demo-assets/beauty/brands/cocoon.webp",
    name: "Cocoon",
    slug: "cocoon"
  },
  {
    imageAlt: "Dewline pump bottle on a pale background",
    imageUrl: "/demo-assets/beauty/brands/dewline.webp",
    name: "Dewline",
    slug: "dewline"
  },
  {
    imageAlt: "Lumen Skin treatment mask jar",
    imageUrl: "/demo-assets/beauty/brands/lumen-skin.webp",
    name: "Lumen Skin",
    slug: "lumen-skin"
  },
  {
    imageAlt: "Petalworks powder brush",
    imageUrl: "/demo-assets/beauty/brands/petalworks.webp",
    name: "Petalworks",
    slug: "petalworks"
  },
  {
    imageAlt: "Rosewood red lipstick bullet",
    imageUrl: "/demo-assets/beauty/brands/rosewood.webp",
    name: "Rosewood",
    slug: "rosewood"
  },
  {
    imageAlt: "Silkroot eau de parfum bottle",
    imageUrl: "/demo-assets/beauty/brands/silkroot.webp",
    name: "Silkroot",
    slug: "silkroot"
  },
  {
    imageAlt: "Vellora pressed powder compact with a brush",
    imageUrl: "/demo-assets/beauty/brands/vellora.webp",
    name: "Vellora",
    slug: "vellora"
  }
] satisfies DemoPackBrand[];
