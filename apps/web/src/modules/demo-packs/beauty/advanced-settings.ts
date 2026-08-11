import type { DemoPackAdvancedSettings } from "../types";

/**
 * Section copy owned by the Beauty pack. Seeding writes this to
 * ThemeSetting.advancedSettings, so editing it here changes what a freshly
 * imported store shows without touching the shared storefront defaults.
 *
 * Anything omitted falls back to DEFAULT_STOREFRONT_ADVANCED_SETTINGS - which
 * still carries general-store placeholder copy and points the trending strip at
 * images this pack does not ship, so every string and image path Beauty Default
 * reads is overridden here rather than left to the default.
 */
export const beautyDemoAdvancedSettings = {
  announcement: {
    enabled: true,
    messages: [
      { text: "Cash on delivery available across Bangladesh" },
      { text: "Free delivery on orders above ৳2,000" },
      { text: "Sealed products only - unopened returns within 7 days" }
    ]
  },
  beauty: {
    // The two "results" frames are campaign photographs of the same moisturiser
    // shot on different sets, not a clinical before/after, so the labels name
    // the backdrop and the heading says what is actually being compared. A demo
    // catalogue has no results to claim.
    comparisonAccentColor: "",
    comparisonAfterImageUrl: "/demo-assets/beauty/results/after-01.webp",
    comparisonAfterLabel: "Blush",
    comparisonBeforeImageUrl: "/demo-assets/beauty/results/before-01.webp",
    comparisonBeforeLabel: "Sky",
    comparisonCtaLink: "/categories/skincare",
    comparisonCtaText: "Shop skincare",
    comparisonInitialPosition: 50,
    comparisonTitle: "One face cream, two campaign frames - drag to compare",
    // Six products per tab covers skincare, makeup and hair care in full; the
    // four-tab cap keeps the thinner categories out of this band rather than
    // opening a tab onto two cards.
    curatedProductsPerTab: 6,
    curatedPromoCtaLink: "/products",
    curatedPromoCtaText: "Shop all products",
    curatedPromoEyebrow: "Everyday ritual",
    curatedPromoImageUrls: [
      "/demo-assets/beauty/hero/hero-mobile.webp",
      "/demo-assets/beauty/banners/promo-primary.webp"
    ],
    curatedPromoTitle: "Made to be used up, not displayed",
    curatedTabCount: 4,
    curatedTitle: "Curated by category",
    hotPicksCtaLink: "/products?sort=best-selling",
    hotPicksCtaText: "Shop best sellers",
    hotPicksDescription:
      "The twenty-four products in this catalogue, filtered by category - lips and complexion, scalp and lengths, face and body.",
    hotPicksProductCount: 12,
    hotPicksTabCount: 6,
    hotPicksTitle: "Hot beauty picks",
    // The strip is five portrait crops of the category photography, which is the
    // only people-and-product art the pack ships; the category row near the top
    // of the page shows the same frames square and uncropped.
    momentsDescription:
      "Skin, hair and body - the same six categories, photographed the way the products actually get used.",
    momentsImageUrls: [
      "/demo-assets/beauty/categories/haircare.webp",
      "/demo-assets/beauty/categories/bodycare.webp",
      "/demo-assets/beauty/categories/skincare.webp",
      "/demo-assets/beauty/categories/makeup.webp",
      "/demo-assets/beauty/categories/beauty-tools.webp"
    ],
    momentsTitle: "Tap Into Trending",
    momentsTitleAccent: "Beauty Moments",
    spotlightCategorySlug: "skincare",
    spotlightCtaLink: "/categories/skincare",
    spotlightCtaText: "Shop skincare",
    spotlightDescription:
      "Six products that cover a full routine - sunscreen, cleanser-weight lotion, two serums, a night cream and a weekly masque. Nothing here needs anything else in the catalogue to work.",
    spotlightImageUrl: "/demo-assets/beauty/banners/promo-secondary.webp",
    spotlightProductCount: 4,
    spotlightTitle: "A routine in six products"
  },
  cartPage: {
    freeShippingAmount: 2000,
    freeShippingText: "Add {amount} more to qualify for free delivery."
  },
  footer: {
    columns: [
      {
        links: [
          { label: "Skincare", url: "/categories/skincare" },
          { label: "Makeup", url: "/categories/makeup" },
          { label: "Hair care", url: "/categories/haircare" },
          { label: "Body care", url: "/categories/bodycare" },
          { label: "Fragrance", url: "/categories/fragrance" },
          { label: "Beauty tools", url: "/categories/beauty-tools" }
        ],
        title: "Shop"
      },
      {
        links: [
          { label: "All products", url: "/products" },
          { label: "New arrivals", url: "/products?sort=newest" },
          { label: "Track order", url: "/orders" },
          { label: "My account", url: "/account" },
          { label: "Search", url: "/search" }
        ],
        title: "Customer Support"
      }
    ],
    description:
      "Twenty-four demo products across skincare, makeup, hair care, body care, fragrance and tools - priced in BDT with cash on delivery across Bangladesh. Replace this copy with your own store description before launch.",
    paymentIcons: ["Visa", "Mastercard", "bKash", "Nagad", "Rocket"]
  },
  header: {
    menuItems: [
      { label: "Shop", url: "/products" },
      { label: "Skincare", url: "/categories/skincare" },
      { label: "Makeup", url: "/categories/makeup" },
      { label: "Hair care", url: "/categories/haircare" },
      { label: "New arrivals", url: "/products?sort=newest" }
    ]
  },
  hero: {
    // Three wide editorial crops. All three leave their left third to backdrop,
    // so the copy sits left and the scrim only has to be heavy enough to carry
    // white type over a light set.
    align: "left",
    button1Link: "/products",
    button1Text: "Shop all products",
    button2Link: "/categories",
    button2Text: "Browse categories",
    buttonStyle: "light",
    contentType: "image-slider",
    height: "large",
    layoutWidth: "full",
    overlayColor: "#2d1721",
    overlayOpacity: 42,
    slides: [
      {
        mediaType: "image",
        subtitle: "TWENTY-FOUR PRODUCTS, SIX CATEGORIES",
        title: "Skin, hair and\neverything after.",
        url: "/demo-assets/beauty/hero/hero-01.webp"
      },
      {
        mediaType: "image",
        subtitle: "SKINCARE",
        title: "A routine you\nwill actually finish.",
        url: "/demo-assets/beauty/hero/hero-02.webp"
      },
      {
        mediaType: "image",
        subtitle: "MASKS AND TREATMENTS",
        title: "The weekly step,\nworth the ten minutes.",
        url: "/demo-assets/beauty/hero/hero-03.webp"
      }
    ],
    subtitle: "TWENTY-FOUR PRODUCTS, SIX CATEGORIES",
    textColor: "#ffffff",
    title: "Skin, hair and\neverything after."
  },
  miniCart: {
    freeShippingAmount: 2000,
    freeShippingText: "Add {amount} more to qualify for free delivery."
  },
  productSections: {
    bestSellers: {
      count: 12,
      ctaText: "View all",
      subtitle:
        "Ranked by units sold. Until this store has orders, it shows the newest active products.",
      title: "Most loved beauty picks"
    },
    // Not rendered as its own row on the Beauty homepage - this pool is what the
    // curated tabs and the spotlight grid are built from, so the count is the
    // whole catalogue rather than one row's worth.
    featured: {
      count: 24,
      ctaText: "Shop all",
      subtitle: "A few picks from every category.",
      title: "Featured beauty essentials"
    },
    listing: {
      ctaText: "Shop all",
      subtitle: "All 24 demo products. Filter by category, brand, price or availability.",
      title: "All products"
    },
    newArrivals: {
      count: 12,
      ctaText: "View all",
      subtitle: "The most recently added formulas and shades in this catalogue.",
      title: "Fresh formulas and new shades"
    },
    related: {
      ctaText: "View all",
      subtitle: "Other products in the same category.",
      title: "Complete the routine"
    },
    search: {
      subtitle: "Products matching your search.",
      title: "Search results"
    },
    trending: {
      count: 12,
      ctaText: "Shop all",
      subtitle: "The products moving fastest across the catalogue this week.",
      title: "Trending now"
    }
  },
  shopPage: {
    description:
      "Twenty-four demo products across skincare, makeup, hair care, body care, fragrance and beauty tools.",
    pageTitle: "All products"
  }
} satisfies DemoPackAdvancedSettings;
