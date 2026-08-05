import type { DemoPackAdvancedSettings } from "../types";

/**
 * Section copy owned by the General pack. Seeding writes this to
 * ThemeSetting.advancedSettings, so editing it here changes what a freshly
 * imported store shows without touching the shared storefront defaults.
 *
 * Anything omitted falls back to DEFAULT_STOREFRONT_ADVANCED_SETTINGS.
 */
export const generalDemoAdvancedSettings = {
  announcement: {
    enabled: true,
    messages: [
      { text: "Cash on delivery available across Bangladesh" },
      { text: "Free delivery on orders above ৳2,000" },
      { text: "Easy 7-day returns on unused items" }
    ]
  },
  cartPage: {
    freeShippingAmount: 2000,
    freeShippingText: "Add {amount} more to qualify for free delivery."
  },
  header: {
    menuItems: [
      { label: "Home", url: "/" },
      { label: "Shop", url: "/products" },
      { label: "Categories", url: "/categories" },
      { label: "New Arrivals", url: "/products?sort=newest" }
    ]
  },
  hero: {
    button1Link: "/products",
    button1Text: "Shop all products",
    button2Link: "/categories",
    button2Text: "Browse categories",
    contentType: "image-slider",
    slides: [
      {
        mediaType: "image",
        subtitle: "Twenty-four products across six categories, ready to browse.",
        title: "Everyday essentials for home, work and travel",
        url: "/demo-assets/general/hero/hero-01.webp"
      },
      {
        mediaType: "image",
        subtitle: "Headphones, power banks and chargers for daily use.",
        title: "Practical tech that earns its place in your bag",
        url: "/demo-assets/general/hero/hero-02.webp"
      },
      {
        mediaType: "image",
        subtitle: "Kitchen, storage and comfort pieces for the home.",
        title: "Small upgrades you notice every single day",
        url: "/demo-assets/general/hero/hero-03.webp"
      }
    ],
    subtitle: "Twenty-four products across six categories, ready to browse.",
    title: "Everyday essentials for home, work and travel"
  },
  miniCart: {
    freeShippingAmount: 2000,
    freeShippingText: "Add {amount} more to qualify for free delivery."
  },
  productSections: {
    bestSellers: {
      ctaText: "View all",
      subtitle: "Ranked by units sold. Until this store has orders, it shows the newest active products.",
      title: "Best sellers"
    },
    featured: {
      ctaText: "Shop all",
      subtitle: "A cross-section of the catalogue - one or two picks from each category.",
      title: "Featured products"
    },
    listing: {
      ctaText: "Shop all",
      subtitle: "All 24 demo products. Filter by category, price or availability.",
      title: "All products"
    },
    newArrivals: {
      ctaText: "View all",
      subtitle: "The most recently added products in this catalogue.",
      title: "New arrivals"
    },
    related: {
      ctaText: "View all",
      subtitle: "Other products in the same category.",
      title: "You may also like"
    },
    search: {
      subtitle: "Products matching your search.",
      title: "Search results"
    }
  },
  shopPage: {
    description: "Twenty-four demo products across electronics, home, kitchen, office, sports and accessories.",
    pageTitle: "All products"
  },
  tabbedProductShowcase: {
    description: "The same catalogue, sorted three ways.",
    tabs: [
      { enabled: true, label: "All products", productCount: 10, source: "all" },
      { enabled: true, label: "On sale", productCount: 10, source: "on-sale" },
      { enabled: true, label: "New in", productCount: 10, source: "new-arrivals" }
    ],
    title: "Browse the catalogue"
  }
} satisfies DemoPackAdvancedSettings;
