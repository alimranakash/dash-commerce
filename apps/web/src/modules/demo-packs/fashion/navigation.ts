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
    href: "/categories/womens-clothing",
    label: "Women"
  },
  {
    href: "/categories/mens-clothing",
    label: "Men"
  },
  {
    href: "/categories/footwear",
    label: "Footwear"
  },
  {
    href: "/categories/bags",
    label: "Bags"
  },
  {
    href: "/categories",
    label: "Categories"
  }
] satisfies DemoPackNavigationItem[];
