import type { DemoPackAdvancedSettings } from "../types";

/**
 * Section copy owned by the Fashion pack. Seeding writes this to
 * ThemeSetting.advancedSettings, so editing it here changes what a freshly
 * imported store shows without touching the shared storefront defaults.
 *
 * Anything omitted falls back to DEFAULT_STOREFRONT_ADVANCED_SETTINGS - which
 * still carries the swimwear-boutique placeholder copy, so every fashion-facing
 * string the template reads is overridden here rather than left to the default.
 */
export const fashionDemoAdvancedSettings = {
  announcement: {
    enabled: true,
    messages: [
      { text: "Cash on delivery available across Bangladesh" },
      { text: "Free delivery on orders above ৳2,000" },
      { text: "Size exchange within 7 days on unworn items" }
    ]
  },
  cartPage: {
    freeShippingAmount: 2000,
    freeShippingText: "Add {amount} more to qualify for free delivery."
  },
  fashion: {
    // The wipe compares the two campaign banners - an indoor city look against
    // an outdoor one - so the labels name the setting rather than a before/after.
    beforeAfterAfterImageUrl: "/demo-assets/fashion/banners/promo-secondary.webp",
    beforeAfterAfterLabel: "Coast",
    beforeAfterBeforeImageUrl: "/demo-assets/fashion/banners/promo-primary.webp",
    beforeAfterBeforeLabel: "City",
    beforeAfterInitialPosition: 50,
    communityDescription: "Pieces from this catalogue, worn the way they actually get worn.",
    communityTitle: "Styled by the community",
    editorialBannerCtaLink: "/products",
    editorialBannerCtaText: "Shop the edit",
    editorialBannerImageUrl: "/demo-assets/fashion/banners/promo-primary.webp",
    editorialBannerSubtitle:
      "Cotton, denim, knitwear and leather in colours that carry from one season into the next.",
    editorialBannerTitle: "Twenty-four pieces that work together",
    // Card order follows the homepage category grid, which lists categories
    // alphabetically: Accessories, Bags, Footwear, Jewelry.
    collectionCtas: ["Shop accessories", "Shop bags", "Shop footwear", "Shop jewelry"],
    editorialSplitCtaLink: "/products",
    editorialSplitCtaText: "Shop all",
    // The banner overlays white type on the left panel only, so the darker
    // street shot goes left and the bright studio frame goes right.
    editorialSplitHeading: "Two wardrobes, one standard",
    editorialSplitHeight: 640,
    editorialSplitLeftImageUrl: "/demo-assets/fashion/hero/hero-03.webp",
    editorialSplitOverlayOpacity: 48,
    editorialSplitRightImageUrl: "/demo-assets/fashion/hero/hero-01.webp",
    featuredLookCtaLink: "/categories/womens-clothing",
    featuredLookCtaText: "Shop the look",
    featuredLookDescription:
      "One dress, one bag and one pair of sandals - the whole outfit comes from three different categories in this catalogue.",
    featuredLookImageUrl: "/demo-assets/fashion/hero/hero-mobile.webp",
    featuredLookTitle: "Built from three categories",
    footerAboutLinks: [
      { label: "All products", url: "/products" },
      { label: "All categories", url: "/categories" },
      { label: "Search", url: "/search" },
      { label: "Track order", url: "/orders" },
      { label: "My account", url: "/account" }
    ],
    footerDescription:
      "Twenty-four demo pieces across clothing, footwear, bags, jewelry and accessories - priced in BDT with cash on delivery across Bangladesh. Replace this copy with your own store description before launch.",
    footerLegalLinks: [
      { label: "Shipping", url: "/products" },
      { label: "Returns and exchanges", url: "/products" },
      { label: "Size guide", url: "/products" },
      { label: "Privacy policy", url: "/products" }
    ],
    footerNewsletterDescription:
      "New arrivals, restocks and seasonal markdowns, sent when there is something worth sending.",
    footerNewsletterTitle: "Join the list",
    footerPressLogos: ["Northloom", "Denim Co", "Solestep", "Carryall", "Auriva"],
    footerShopLinks: [
      { label: "Women's clothing", url: "/categories/womens-clothing" },
      { label: "Men's clothing", url: "/categories/mens-clothing" },
      { label: "Footwear", url: "/categories/footwear" },
      { label: "Bags", url: "/categories/bags" },
      { label: "Jewelry", url: "/categories/jewelry" },
      { label: "Accessories", url: "/categories/accessories" }
    ],
    newArrivalsDescription:
      "The most recently added pieces across all six categories, newest first.",
    newArrivalsTitle: "New arrivals",
    newsletterButtonText: "Subscribe",
    newsletterDescription:
      "Get new arrivals, restocks and markdowns before they reach the homepage.",
    newsletterImageUrl: "/demo-assets/fashion/banners/promo-secondary.webp",
    newsletterTitle: "First look at what lands next"
  },
  footer: {
    columns: [
      {
        links: [
          { label: "Home", url: "/" },
          { label: "Shop all", url: "/products" },
          { label: "Categories", url: "/categories" },
          { label: "New arrivals", url: "/products?sort=newest" }
        ],
        title: "Shop"
      },
      {
        links: [
          { label: "Track order", url: "/orders" },
          { label: "My account", url: "/account" },
          { label: "Cart", url: "/cart" },
          { label: "Search", url: "/search" }
        ],
        title: "Customer Support"
      }
    ],
    description:
      "Clothing, footwear, bags and accessories for everyday wear. Cash on delivery across Bangladesh.",
    paymentIcons: ["Visa", "Mastercard", "bKash", "Nagad", "Rocket"]
  },
  header: {
    menuItems: [
      { label: "Home", url: "/" },
      { label: "Women", url: "/categories/womens-clothing" },
      { label: "Men", url: "/categories/mens-clothing" },
      { label: "Footwear", url: "/categories/footwear" },
      { label: "Bags", url: "/categories/bags" },
      { label: "New Arrivals", url: "/products?sort=newest" }
    ]
  },
  hero: {
    // The three slides are wide editorial crops on light backgrounds, so the
    // copy sits left over the empty side of each frame and the dark scrim is
    // heavy enough to carry white type across all three.
    align: "left",
    button1Link: "/products",
    button1Text: "Shop all products",
    button2Link: "/categories",
    button2Text: "Browse categories",
    buttonStyle: "light",
    contentType: "image-slider",
    height: "large",
    layoutWidth: "full",
    overlayColor: "#100e0d",
    overlayOpacity: 50,
    slides: [
      {
        mediaType: "image",
        subtitle: "TWENTY-FOUR PIECES, SIX CATEGORIES",
        title: "Dressed for\nthe everyday.",
        url: "/demo-assets/fashion/hero/hero-01.webp"
      },
      {
        mediaType: "image",
        subtitle: "MENSWEAR",
        title: "Tailoring that\nkeeps its shape.",
        url: "/demo-assets/fashion/hero/hero-02.webp"
      },
      {
        mediaType: "image",
        subtitle: "OUTERWEAR AND LAYERS",
        title: "Layers for\nthe cooler months.",
        url: "/demo-assets/fashion/hero/hero-03.webp"
      }
    ],
    subtitle: "TWENTY-FOUR PIECES, SIX CATEGORIES",
    textColor: "#ffffff",
    title: "Dressed for\nthe everyday."
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
      subtitle: "A cross-section of the catalogue - a few picks from each category.",
      title: "Featured pieces"
    },
    listing: {
      ctaText: "Shop all",
      subtitle: "All 24 demo pieces. Filter by category, brand, price or availability.",
      title: "All products"
    },
    newArrivals: {
      ctaText: "View all",
      subtitle: "The most recently added pieces in this catalogue.",
      title: "New arrivals"
    },
    related: {
      ctaText: "View all",
      subtitle: "Other pieces in the same category.",
      title: "Complete the look"
    },
    search: {
      subtitle: "Pieces matching your search.",
      title: "Search results"
    },
    trending: {
      ctaText: "Shop all",
      subtitle: "The pieces moving fastest across the catalogue this week.",
      title: "Trending now"
    }
  },
  shopPage: {
    description:
      "Twenty-four demo pieces across women's clothing, men's clothing, footwear, bags, jewelry and accessories.",
    pageTitle: "All products"
  },
  tabbedProductShowcase: {
    description: "The same catalogue, sorted three ways.",
    tabs: [
      { enabled: true, label: "All pieces", productCount: 10, source: "all" },
      { enabled: true, label: "On sale", productCount: 10, source: "on-sale" },
      { enabled: true, label: "New in", productCount: 10, source: "new-arrivals" }
    ],
    title: "Browse the catalogue"
  }
} satisfies DemoPackAdvancedSettings;
