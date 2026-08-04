import type { DemoPackCategory } from "../types";

export const electronicsDemoCategories = [
  {
    description: "Fictional mobile devices and everyday smartphone essentials.",
    imageAlt: "Smartphones demo category image",
    imageUrl: "/demo-assets/electronics/categories/phones.webp",
    name: "Smartphones",
    slug: "smartphones"
  },
  {
    description: "Fictional laptops for work, study, and entertainment.",
    imageAlt: "Laptops demo category image",
    imageUrl: "/demo-assets/electronics/categories/laptops.webp",
    name: "Laptops",
    slug: "laptops"
  },
  {
    description: "Fictional tech add-ons, chargers, cases, and productivity extras.",
    imageAlt: "Electronics accessories demo category image",
    imageUrl: "/demo-assets/electronics/categories/watches.webp",
    name: "Accessories",
    slug: "accessories"
  },
  {
    description: "Fictional connected devices for modern homes.",
    imageAlt: "Smart home demo category image",
    name: "Smart Home",
    slug: "smart-home"
  },
  {
    description: "Fictional gaming gear for immersive play.",
    imageAlt: "Gaming demo category image",
    imageUrl: "/demo-assets/electronics/categories/gaming.webp",
    name: "Gaming",
    slug: "gaming"
  },
  {
    description: "Fictional headphones, speakers, and audio devices.",
    imageAlt: "Audio demo category image",
    imageUrl: "/demo-assets/electronics/categories/speakers.webp",
    name: "Audio",
    slug: "audio"
  }
] satisfies DemoPackCategory[];
