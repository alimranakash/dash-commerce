import type { DemoPackAdvancedSettings } from "../types";

/**
 * Section copy owned by the Electronics pack. Seeding writes this to
 * ThemeSetting.advancedSettings, so editing it here changes what a freshly
 * imported store shows without touching the shared storefront defaults.
 *
 * Anything omitted falls back to DEFAULT_STOREFRONT_ADVANCED_SETTINGS.
 */
export const electronicsDemoAdvancedSettings = {
  announcement: {
    enabled: true,
    messages: [
      { text: "Cash on delivery available across Bangladesh" },
      { text: "Free delivery on orders above ৳2,000" },
      { text: "Official warranty on every device" }
    ]
  },
  cartPage: {
    freeShippingAmount: 2000,
    freeShippingText: "Add {amount} more to qualify for free delivery."
  },
  electronics: {
    brandSectionTitle: "Featured brands",
    categorySectionTitle: "Shop by category",
    featuredSectionTitle: "Featured products",
    flashDealEyebrow: "Flash Deals",
    flashDealTitle: "Limited-time tech offers",
    footerCollectionLinks: [
      { label: "Earbuds", url: "/search?q=earbuds" },
      { label: "Smartwatches", url: "/search?q=smartwatch" },
      { label: "Power banks", url: "/search?q=power%20bank" },
      { label: "Keyboards", url: "/search?q=keyboard" },
      { label: "Monitors", url: "/search?q=monitor" }
    ],
    footerInformationLinks: [
      { label: "FAQs", url: "#faqs" },
      { label: "Shipping", url: "#shipping" },
      { label: "About us", url: "#about" },
      { label: "Contact", url: "#contact" }
    ],
    heroPromoCards: [
      {
        backgroundColor: "#ece6f3",
        badge: "Gaming",
        ctaLink: "/categories/gaming",
        ctaText: "Shop now",
        description: "",
        imageUrl: "",
        title: "Headsets, controllers and keyboards"
      },
      {
        backgroundColor: "#e9edf6",
        badge: "Audio",
        ctaLink: "/categories/audio",
        ctaText: "Shop now",
        description: "",
        imageUrl: "",
        title: "Earbuds, speakers and headphones"
      },
      {
        backgroundColor: "#f2ebe4",
        badge: "Wearables",
        ctaLink: "/categories/wearables",
        ctaText: "Shop now",
        description: "",
        imageUrl: "",
        title: "Smartwatches and fitness bands"
      }
    ],
    newArrivalsTitle: "Latest devices and accessories",
    newsletterDescription: "Get updates on new devices, deals and restocks.",
    newsletterTitle: "Subscribe to our newsletter",
    promoCards: [
      {
        backgroundColor: "#e6f0f1",
        badge: "Smart Home",
        ctaLink: "/categories/home-tech",
        ctaText: "Shop now",
        description: "Bulbs, plugs, cameras and routers that talk to your phone.",
        imageUrl: "/demo-assets/electronics/banners/promo-secondary.webp",
        title: "Home Tech"
      },
      {
        backgroundColor: "#eaebf1",
        badge: "Work Setup",
        ctaLink: "/categories/computing",
        ctaText: "Shop now",
        description: "Laptops, monitors, webcams and desk peripherals.",
        imageUrl: "",
        title: "Computing"
      },
      {
        backgroundColor: "#e9edf6",
        badge: "",
        ctaLink: "/categories/audio",
        ctaText: "Shop now",
        description: "",
        imageUrl: "",
        title: "Audio"
      },
      {
        backgroundColor: "#e9efe9",
        badge: "",
        ctaLink: "/categories/mobile-accessories",
        ctaText: "Shop now",
        description: "",
        imageUrl: "",
        title: "Mobile Accessories"
      },
      {
        backgroundColor: "#ece6f3",
        badge: "",
        ctaLink: "/categories/gaming",
        ctaText: "Shop now",
        description: "Gear for sessions measured in hours.",
        imageUrl: "",
        title: "Gaming"
      }
    ],
    promoSectionTitle: "Popular picks across the catalogue",
    recommendedTitle: "Recommended for you",
    supportText: "Need help? Call us: +880 1700 000000",
    trustItems: [
      {
        title: "Official Warranty",
        description: "Clear warranty support for compatible products."
      },
      { title: "Fast Delivery", description: "Delivery rates and zones configured by the seller." },
      { title: "Secure Payment", description: "Checkout methods are managed per store." },
      { title: "Easy Returns", description: "Prepare return policy messaging for customers." }
    ]
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
        title: "New season electronics",
        url: "/demo-assets/electronics/hero/hero-01.webp"
      },
      {
        mediaType: "image",
        subtitle: "Earbuds, speakers, smartwatches and the bands that go with them.",
        title: "Sound that travels",
        url: "/demo-assets/electronics/hero/hero-02.webp"
      },
      {
        mediaType: "image",
        subtitle: "Laptops, monitors, keyboards and everything else the desk needs.",
        title: "Build your desk",
        url: "/demo-assets/electronics/hero/hero-03.webp"
      }
    ],
    subtitle: "Twenty-four products across six categories, ready to browse.",
    title: "New season electronics"
  },
  miniCart: {
    freeShippingAmount: 2000,
    freeShippingText: "Add {amount} more to qualify for free delivery."
  },
  productSections: {
    bestSellers: {
      ctaText: "View all",
      subtitle:
        "Ranked by units sold. Until this store has orders, it shows the newest active products.",
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
    description:
      "Twenty-four demo products across audio, mobile accessories, computing, wearables, home tech and gaming.",
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
