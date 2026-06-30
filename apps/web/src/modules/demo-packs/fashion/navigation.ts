import type { DemoPackNavigationItem } from "../types";

export const fashionDemoNavigation = [
  {
    href: "/",
    label: "Home"
  },
  {
    href: "/products?sort=newest",
    label: "New Arrivals"
  },
  {
    href: "/categories/men",
    label: "Men"
  },
  {
    href: "/categories/women",
    label: "Women"
  },
  {
    href: "/categories/shoes",
    label: "Shoes"
  },
  {
    href: "/contact",
    label: "Contact"
  }
] satisfies DemoPackNavigationItem[];
