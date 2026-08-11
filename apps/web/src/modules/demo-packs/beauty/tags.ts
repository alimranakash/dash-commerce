import type { DemoPackTag } from "../types";

/**
 * Filter chips on the shop and category pages. These stay to formulation and
 * merchandising facts a seller can stand behind - nothing that reads as a
 * clinical or dermatological claim, since the catalogue is demo content.
 */
export const beautyDemoTags = [
  { name: "Best Seller", slug: "best-seller" },
  { name: "New Arrival", slug: "new-arrival" },
  { name: "On Sale", slug: "on-sale" },
  { name: "Vegan", slug: "vegan" },
  { name: "Cruelty Free", slug: "cruelty-free" },
  { name: "Fragrance Free", slug: "fragrance-free" },
  { name: "Hydrating", slug: "hydrating" },
  { name: "Sensitive Skin", slug: "sensitive-skin" },
  { name: "Clean Beauty", slug: "clean-beauty" },
  { name: "Everyday Ritual", slug: "everyday-ritual" },
  { name: "Limited Stock", slug: "limited-stock" },
  { name: "Gift Idea", slug: "gift-idea" }
] satisfies DemoPackTag[];
