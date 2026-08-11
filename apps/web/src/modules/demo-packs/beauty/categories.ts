import type { DemoPackCategory } from "../types";

/**
 * Six categories, one per image under apps/web/public/demo-assets/beauty/categories/.
 * The slug matches the filename so a category and its art can never drift apart.
 */
export const beautyDemoCategories = [
  {
    description:
      "Cleansers, serums, sunscreen and moisturisers for a routine that fits around a working day.",
    imageAlt: "Hand holding a skincare bottle in daylight",
    imageUrl: "/demo-assets/beauty/categories/skincare.webp",
    name: "Skincare",
    slug: "skincare"
  },
  {
    description:
      "Lips, complexion and eyes - eight everyday shades rather than a full colour wall.",
    imageAlt: "Lip pencil and its swatch on a pale background",
    imageUrl: "/demo-assets/beauty/categories/makeup.webp",
    name: "Makeup",
    slug: "makeup"
  },
  {
    description: "Shampoos, oils and weekly masks for scalps that get washed more often than most.",
    imageAlt: "Person washing their hair under running water",
    imageUrl: "/demo-assets/beauty/categories/haircare.webp",
    name: "Hair Care",
    slug: "haircare"
  },
  {
    description: "Body creams and a lightweight body serum for skin below the jawline.",
    imageAlt: "Body oil bottle held against a shoulder",
    imageUrl: "/demo-assets/beauty/categories/bodycare.webp",
    name: "Body Care",
    slug: "bodycare"
  },
  {
    description: "Eau de parfum in a size that travels without being decanted.",
    imageAlt: "Fragrance category tile",
    imageUrl: "/demo-assets/beauty/categories/fragrance.webp",
    name: "Fragrance",
    slug: "fragrance"
  },
  {
    description: "Applicators and blending tools - the part of a routine that gets replaced most.",
    imageAlt: "Pink powder brush on a white background",
    imageUrl: "/demo-assets/beauty/categories/beauty-tools.webp",
    name: "Beauty Tools",
    slug: "beauty-tools"
  }
] satisfies DemoPackCategory[];
