import type { DemoPackNavigationItem } from "../types";

export const beautyDemoNavigation = [
  {
    href: "/",
    label: "Home"
  },
  {
    href: "/products?sort=newest",
    label: "New Arrivals"
  },
  {
    href: "/categories/skincare",
    label: "Skincare"
  },
  {
    href: "/categories/makeup",
    label: "Makeup"
  },
  {
    href: "/categories/haircare",
    label: "Hair Care"
  },
  {
    href: "/categories/bodycare",
    label: "Body Care"
  },
  {
    href: "/categories",
    label: "Categories"
  }
] satisfies DemoPackNavigationItem[];
