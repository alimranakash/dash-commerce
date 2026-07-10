export type StorefrontMessage = {
  link?: string;
  text: string;
};

export type StorefrontMenuItem = {
  label: string;
  url: string;
};

export type StorefrontHeroSlide = {
  mediaType: "image" | "video" | "youtube";
  subtitle?: string;
  title?: string;
  url: string;
};

export type StorefrontProductSectionSettings = {
  columns: 2 | 3 | 4 | 5;
  count: number;
  ctaLink: string;
  ctaText: string;
  enableBadges: boolean;
  enableComparePrice: boolean;
  enableHoverImage: boolean;
  enableVariants: boolean;
  mode: "grid" | "slider";
  source: "manual" | "featured" | "best-sellers" | "new-arrivals" | "trending" | "related" | "search" | "recently-viewed";
  subtitle: string;
  title: string;
};

export type StorefrontProductPageSettings = {
  accordionEnabled: boolean;
  addToCartButtonColor: string;
  addToCartButtonRadius: number;
  addToCartText: string;
  breadcrumbEnabled: boolean;
  buyNowEnabled: boolean;
  galleryLayout: "two-column" | "vertical" | "horizontal";
  gallerySpacing: number;
  imageRatio: "portrait" | "square" | "wide";
  lightboxEnabled: boolean;
  promoBlocksEnabled: boolean;
  shippingEnabled: boolean;
  shippingNotice: string;
  variantEnabled: boolean;
  variantStyle: "buttons" | "dropdown";
  zoomEnabled: boolean;
};

export type StorefrontTabbedProductSource =
  | "all"
  | "featured"
  | "best-sellers"
  | "new-arrivals"
  | "on-sale"
  | "category"
  | "collection"
  | "manual";

export type StorefrontTabbedProductTab = {
  enabled: boolean;
  label: string;
  productCount: number;
  source: StorefrontTabbedProductSource;
};

export type StorefrontTabbedProductShowcaseSettings = {
  arrowsVisible: boolean;
  autoplay: boolean;
  backgroundColor: string;
  defaultActiveTab: number;
  description: string;
  enabled: boolean;
  fullWidth: boolean;
  infiniteLoop: boolean;
  productsPerTab: number;
  productsPerView: 2 | 3 | 4 | 5;
  scrollAmount: "one" | "page";
  sectionSpacing: number;
  sliderEnabled: boolean;
  tabs: StorefrontTabbedProductTab[];
  title: string;
};

export type StorefrontLinkSetting = {
  label: string;
  url: string;
};

export type StorefrontElectronicsPromoCardSettings = {
  backgroundColor: string;
  badge: string;
  ctaLink: string;
  ctaText: string;
  description: string;
  imageUrl: string;
  title: string;
};

export type StorefrontElectronicsHomepageSettings = {
  brandSectionTitle: string;
  categorySectionTitle: string;
  featuredSectionTitle: string;
  flashDealTitle: string;
  flashDealEyebrow: string;
  footerCollectionLinks: StorefrontLinkSetting[];
  footerInformationLinks: StorefrontLinkSetting[];
  heroPromoCards: StorefrontElectronicsPromoCardSettings[];
  newsletterDescription: string;
  newsletterTitle: string;
  promoCards: StorefrontElectronicsPromoCardSettings[];
  promoSectionTitle: string;
  recommendedTitle: string;
  supportText: string;
  trustItems: Array<{
    description: string;
    title: string;
  }>;
  newArrivalsTitle: string;
};

export type StorefrontFashionHomepageSettings = {
  beforeAfterAfterImageUrl: string;
  beforeAfterAfterLabel: string;
  beforeAfterBeforeImageUrl: string;
  beforeAfterBeforeLabel: string;
  beforeAfterInitialPosition: number;
  collectionCtas: string[];
  communityDescription: string;
  communityImages: string[];
  communityTitle: string;
  editorialBannerCtaLink: string;
  editorialBannerCtaText: string;
  editorialBannerImageUrl: string;
  editorialBannerSubtitle: string;
  editorialBannerTitle: string;
  editorialSplitCtaLink: string;
  editorialSplitCtaText: string;
  editorialSplitHeading: string;
  editorialSplitHeight: number;
  editorialSplitLeftImageUrl: string;
  editorialSplitOverlayOpacity: number;
  editorialSplitRightImageUrl: string;
  featuredLookCtaLink: string;
  featuredLookCtaText: string;
  featuredLookDescription: string;
  featuredLookImageUrl: string;
  featuredLookTitle: string;
  footerAboutLinks: StorefrontLinkSetting[];
  footerDescription: string;
  footerLegalLinks: StorefrontLinkSetting[];
  footerNewsletterDescription: string;
  footerNewsletterTitle: string;
  footerPressLogos: string[];
  footerShopLinks: StorefrontLinkSetting[];
  newArrivalsDescription: string;
  newArrivalsTitle: string;
  newsletterButtonText: string;
  newsletterDescription: string;
  newsletterImageUrl: string;
  newsletterTitle: string;
};

export type StorefrontShopPageSortOption =
  | "featured"
  | "newest"
  | "best-selling"
  | "price-asc"
  | "price-desc"
  | "alpha-asc"
  | "alpha-desc";

export type StorefrontShopPageSettings = {
  defaultSort: StorefrontShopPageSortOption;
  description: string;
  descriptionEnabled: boolean;
  enableAvailabilityFilter: boolean;
  enableBrandFilter: boolean;
  enableCategoryFilter: boolean;
  enableColorFilter: boolean;
  enableCollectionFilter: boolean;
  enableComparePrice: boolean;
  enableFilters: boolean;
  enableHoverImage: boolean;
  enableProductBadges: boolean;
  enableProductBrand: boolean;
  enableProductColorCount: boolean;
  enablePriceFilter: boolean;
  enableQuickView: boolean;
  enableSizeFilter: boolean;
  enableSorting: boolean;
  enableTagFilter: boolean;
  enableResultCounter: boolean;
  gridSpacing: number;
  paginationMode: "pagination" | "load-more";
  pageTitle: string;
  productsPerPage: number;
  productsPerRow: 2 | 3 | 4;
  sectionSpacing: number;
  sortOptions: StorefrontShopPageSortOption[];
  widthMode: "full" | "boxed" | "custom";
};

export type StorefrontCartPageSettings = {
  breadcrumbEnabled: boolean;
  checkoutButtonBackgroundColor: string;
  checkoutButtonBorderRadius: number;
  checkoutButtonText: string;
  checkoutButtonTextColor: string;
  continueShoppingLink: string;
  estimatedDeliveryEnabled: boolean;
  freeShippingAmount: number;
  freeShippingCtaLink: string;
  freeShippingCtaText: string;
  freeShippingEnabled: boolean;
  freeShippingText: string;
  orderNotesEnabled: boolean;
  showBrand: boolean;
  showRemoveButton: boolean;
  showVariant: boolean;
  taxesEnabled: boolean;
  widthMode: "full" | "boxed";
};

export type StorefrontMiniCartSettings = {
  autoOpenAfterAdd: boolean;
  checkoutButtonBackgroundColor: string;
  checkoutButtonBorderRadius: number;
  checkoutButtonEnabled: boolean;
  checkoutButtonText: string;
  checkoutButtonTextColor: string;
  drawerWidth: number;
  enabled: boolean;
  freeShippingAmount: number;
  freeShippingCtaLink: string;
  freeShippingCtaText: string;
  freeShippingEnabled: boolean;
  freeShippingText: string;
  orderNotesEnabled: boolean;
  overlayOpacity: number;
  showBrand: boolean;
  showItemCount: boolean;
  showQuantity: boolean;
  showRemoveButton: boolean;
  showVariant: boolean;
  viewCartButtonEnabled: boolean;
  viewCartButtonLink: string;
  viewCartButtonText: string;
};

export type StorefrontAdvancedSettings = {
  announcement: {
    backgroundColor: string;
    enabled: boolean;
    fontSize: number;
    messages: StorefrontMessage[];
    scrollSpeed: "slow" | "normal" | "fast";
    textColor: string;
  };
  header: {
    backgroundColor: string;
    enabled: boolean;
    height: number;
    logoText?: string;
    menuItems: StorefrontMenuItem[];
    showAccount: boolean;
    showCart: boolean;
    showCurrency: boolean;
    showSearch: boolean;
    spacing: number;
    sticky: boolean;
    textColor: string;
  };
  hero: {
    align: "left" | "center" | "right";
    autoplay: boolean;
    button1Link: string;
    button1Text: string;
    button2Link: string;
    button2Text: string;
    buttonStyle: "filled" | "outline" | "light";
    contentType: "single-image" | "image-slider" | "single-video" | "video-slider" | "mixed-slider" | "youtube";
    customHeight?: number | undefined;
    customWidth?: number | undefined;
    enabled: boolean;
    height: "small" | "medium" | "large" | "custom";
    imageUrl?: string | undefined;
    layoutWidth: "full" | "boxed" | "custom";
    overlayColor: string;
    overlayOpacity: number;
    showArrows: boolean;
    showDots: boolean;
    sliderSpeed: number;
    slides: StorefrontHeroSlide[];
    subtitle: string;
    textColor: string;
    title: string;
    videoUrl?: string | undefined;
    youtubeUrl?: string | undefined;
  };
  cartPage: StorefrontCartPageSettings;
  miniCart: StorefrontMiniCartSettings;
  layout: {
    boxedMaxWidth: number;
    pageBackgroundColor: string;
    sectionPadding: number;
    widthMode: "full" | "boxed";
  };
  productSections: {
    bestSellers: StorefrontProductSectionSettings;
    featured: StorefrontProductSectionSettings;
    listing: StorefrontProductSectionSettings;
    newArrivals: StorefrontProductSectionSettings;
    related: StorefrontProductSectionSettings;
    recentlyViewed: StorefrontProductSectionSettings;
    search: StorefrontProductSectionSettings;
    trending: StorefrontProductSectionSettings;
  };
  electronics: StorefrontElectronicsHomepageSettings;
  fashion: StorefrontFashionHomepageSettings;
  productPage: StorefrontProductPageSettings;
  shopPage: StorefrontShopPageSettings;
  tabbedProductShowcase: StorefrontTabbedProductShowcaseSettings;
};

export const DEFAULT_STOREFRONT_ADVANCED_SETTINGS: StorefrontAdvancedSettings = {
  announcement: {
    backgroundColor: "#4b2267",
    enabled: true,
    fontSize: 13,
    messages: [
      { text: "Easy returns for 365 days" },
      { text: "Secure payment methods" },
      { text: "Free shipping for orders above $100" }
    ],
    scrollSpeed: "normal",
    textColor: "#ffffff"
  },
  header: {
    backgroundColor: "#ffffff",
    enabled: true,
    height: 92,
    menuItems: [
      { label: "Sale", url: "/products" },
      { label: "New Arrivals", url: "/products?sort=newest" },
      { label: "Best Sellers", url: "/products" },
      { label: "Categories", url: "/categories" },
      { label: "About", url: "/" }
    ],
    showAccount: true,
    showCart: true,
    showCurrency: true,
    showSearch: true,
    spacing: 48,
    sticky: false,
    textColor: "#171717"
  },
  hero: {
    align: "center",
    autoplay: true,
    button1Link: "/products",
    button1Text: "Shop Now",
    button2Link: "/categories",
    button2Text: "View Categories",
    buttonStyle: "light",
    contentType: "single-image",
    enabled: true,
    height: "large",
    imageUrl: "/demo-assets/general/hero/hero-01.webp",
    layoutWidth: "full",
    overlayColor: "#000000",
    overlayOpacity: 30,
    showArrows: true,
    showDots: true,
    sliderSpeed: 5000,
    slides: [
      {
        mediaType: "image",
        subtitle: "Thoughtfully selected products for everyday living",
        title: "Discover Quality Products for Every Lifestyle",
        url: "/demo-assets/general/hero/hero-01.webp"
      }
    ],
    subtitle: "Thoughtfully selected products for everyday living",
    textColor: "#ffffff",
    title: "Discover Quality Products for Every Lifestyle"
  },
  cartPage: {
    breadcrumbEnabled: true,
    checkoutButtonBackgroundColor: "#000000",
    checkoutButtonBorderRadius: 0,
    checkoutButtonText: "Go to Checkout",
    checkoutButtonTextColor: "#ffffff",
    continueShoppingLink: "/products",
    estimatedDeliveryEnabled: true,
    freeShippingAmount: 250,
    freeShippingCtaLink: "/products",
    freeShippingCtaText: "Shop Now",
    freeShippingEnabled: true,
    freeShippingText: "Just {amount} away from free shipping.",
    orderNotesEnabled: true,
    showBrand: true,
    showRemoveButton: true,
    showVariant: true,
    taxesEnabled: false,
    widthMode: "full"
  },
  miniCart: {
    autoOpenAfterAdd: true,
    checkoutButtonBackgroundColor: "#000000",
    checkoutButtonBorderRadius: 0,
    checkoutButtonEnabled: true,
    checkoutButtonText: "Go to Checkout",
    checkoutButtonTextColor: "#ffffff",
    drawerWidth: 460,
    enabled: true,
    freeShippingAmount: 250,
    freeShippingCtaLink: "/products",
    freeShippingCtaText: "Shop Now",
    freeShippingEnabled: true,
    freeShippingText: "Just {amount} away from free shipping.",
    orderNotesEnabled: true,
    overlayOpacity: 42,
    showBrand: true,
    showItemCount: true,
    showQuantity: true,
    showRemoveButton: true,
    showVariant: true,
    viewCartButtonEnabled: true,
    viewCartButtonLink: "/cart",
    viewCartButtonText: "View Cart"
  },
  layout: {
    boxedMaxWidth: 1440,
    pageBackgroundColor: "#ffffff",
    sectionPadding: 64,
    widthMode: "full"
  },
  productSections: {
    bestSellers: productSectionDefault({
      ctaText: "View all",
      mode: "slider",
      source: "best-sellers",
      subtitle: "Customer favorites selected from the public catalog.",
      title: "Best Sellers"
    }),
    featured: productSectionDefault({
      ctaText: "Shop Now",
      mode: "slider",
      source: "featured",
      subtitle: "Pieces made for repeat use - versatile in size, dependable in design, and easy to carry.",
      title: "The Daily Edit"
    }),
    listing: productSectionDefault({
      count: 12,
      ctaText: "Shop all",
      source: "featured",
      subtitle: "Browse the collection with a clean, focused product view.",
      title: "All Products"
    }),
    newArrivals: productSectionDefault({
      ctaText: "View all",
      mode: "slider",
      source: "new-arrivals",
      subtitle: "Freshly added products from the latest catalog update.",
      title: "New Arrivals"
    }),
    related: productSectionDefault({
      count: 4,
      ctaText: "View all",
      mode: "slider",
      source: "related",
      subtitle: "More products selected from the same collection.",
      title: "You may also like"
    }),
    recentlyViewed: productSectionDefault({
      count: 4,
      ctaText: "View all",
      mode: "slider",
      source: "recently-viewed",
      subtitle: "A clean product rail for items a shopper has viewed recently.",
      title: "Recently Viewed"
    }),
    search: productSectionDefault({
      count: 12,
      ctaText: "Shop all",
      source: "search",
      subtitle: "Products matching your search.",
      title: "Search Results"
    }),
    trending: productSectionDefault({
      ctaText: "View all",
      mode: "slider",
      source: "trending",
      subtitle: "A refined selection of products getting attention now.",
      title: "Trending Products"
    })
  },
  electronics: {
    brandSectionTitle: "Featured brands",
    categorySectionTitle: "Top categories",
    featuredSectionTitle: "Featured products",
    flashDealEyebrow: "Flash Deals",
    flashDealTitle: "Limited-time tech offers",
    footerCollectionLinks: [
      { label: "Headphones", url: "/products?search=headphones" },
      { label: "Smartwatches", url: "/products?search=smartwatch" },
      { label: "Speakers", url: "/products?search=speakers" },
      { label: "Desk lamps", url: "/products?search=desk%20lamp" },
      { label: "Power banks", url: "/products?search=power%20bank" }
    ],
    footerInformationLinks: [
      { label: "FAQs", url: "#faqs" },
      { label: "Shipping", url: "#shipping" },
      { label: "About us", url: "#about" },
      { label: "Contact", url: "#contact" }
    ],
    heroPromoCards: [
      {
        backgroundColor: "#dfe7ff",
        badge: "Gaming",
        ctaLink: "/categories/gaming",
        ctaText: "Shop now",
        description: "",
        imageUrl: "",
        title: "Find ideal gaming consoles"
      },
      {
        backgroundColor: "#f3e8e2",
        badge: "Headphones",
        ctaLink: "/categories/audio",
        ctaText: "Shop now",
        description: "",
        imageUrl: "",
        title: "High-quality sound"
      },
      {
        backgroundColor: "#ecefdb",
        badge: "Smart Watches",
        ctaLink: "/products?search=watch",
        ctaText: "Shop now",
        description: "",
        imageUrl: "",
        title: "Smart features, long battery life"
      }
    ],
    newArrivalsTitle: "Latest devices and accessories",
    newsletterDescription: "Stay updated with our latest news and offers.",
    newsletterTitle: "Subscribe to our newsletter",
    promoCards: [
      {
        backgroundColor: "#373e66",
        badge: "45% OFF",
        ctaLink: "/products?search=electric%20cooker",
        ctaText: "Shop now",
        description: "Let technology do the cooking - now 45% off!",
        imageUrl: "",
        title: "Electric Cooker"
      },
      {
        backgroundColor: "#a9c2e2",
        badge: "35% OFF",
        ctaLink: "/products?search=coffee",
        ctaText: "Shop now",
        description: "Experience bold flavor - 35% off today!",
        imageUrl: "",
        title: "Coffee Machines"
      },
      {
        backgroundColor: "#e7edff",
        badge: "",
        ctaLink: "/products?search=display",
        ctaText: "Shop now",
        description: "",
        imageUrl: "",
        title: "TV & Display"
      },
      {
        backgroundColor: "#d6edf5",
        badge: "",
        ctaLink: "/products?search=air%20fryer",
        ctaText: "Shop now",
        description: "",
        imageUrl: "",
        title: "Air Fryers"
      },
      {
        backgroundColor: "#131b5b",
        badge: "",
        ctaLink: "/products?search=humidifier",
        ctaText: "Shop now",
        description: "Breathe easier and sleep better with cleaner, fresher air.",
        imageUrl: "",
        title: "Humidifier"
      }
    ],
    promoSectionTitle: "Urgent Sale - Home Essentials You'll Love!",
    recommendedTitle: "Recommended for You",
    supportText: "Need help? Call Us: +84 2500 888 33",
    trustItems: [
      { title: "Official Warranty", description: "Clear warranty support for compatible products." },
      { title: "Fast Delivery", description: "Delivery rates and zones configured by the seller." },
      { title: "Secure Payment", description: "Checkout methods are managed per store." },
      { title: "Easy Returns", description: "Prepare return policy messaging for customers." }
    ]
  },
  fashion: {
    beforeAfterAfterImageUrl: "",
    beforeAfterAfterLabel: "After",
    beforeAfterBeforeImageUrl: "",
    beforeAfterBeforeLabel: "Before",
    beforeAfterInitialPosition: 50,
    collectionCtas: ["Shop now", "One pieces", "Swim tops", "Shop cover-ups"],
    communityDescription: "Real style, worn your way.",
    communityImages: [],
    communityTitle: "Styled by the community",
    editorialBannerCtaLink: "/products",
    editorialBannerCtaText: "Explore the edit",
    editorialBannerImageUrl: "",
    editorialBannerSubtitle: "Refined layers, understated textures, and pieces designed to move beautifully together.",
    editorialBannerTitle: "Quiet confidence, cut for everyday movement.",
    editorialSplitCtaLink: "/products",
    editorialSplitCtaText: "Explore",
    editorialSplitHeading: "Timeless classics",
    editorialSplitHeight: 720,
    editorialSplitLeftImageUrl: "",
    editorialSplitOverlayOpacity: 26,
    editorialSplitRightImageUrl: "",
    featuredLookCtaLink: "/products",
    featuredLookCtaText: "Shop the look",
    featuredLookDescription: "A considered edit of pieces designed to work together, season after season.",
    featuredLookImageUrl: "",
    featuredLookTitle: "The art of effortless dressing.",
    footerAboutLinks: [
      { label: "Our blog", url: "#blog" },
      { label: "About Us", url: "#about" },
      { label: "Contact Us", url: "#contact" },
      { label: "FAQs", url: "#faqs" },
      { label: "Search", url: "/search" }
    ],
    footerDescription: "Best Swimwear is a bikini boutique, in sunny Hermosa Beach, California. A warm environment where instead of feeling self-conscious she feels secure in her own body, not limited by age, size or shape, wearing swimwear that fits and feels good.",
    footerLegalLinks: [
      { label: "Privacy Policy", url: "#privacy-policy" },
      { label: "Shipping Policy", url: "#shipping-policy" },
      { label: "FAQs", url: "#faqs" },
      { label: "Returns Policy", url: "#returns-policy" }
    ],
    footerNewsletterDescription: "Be the first to know about sales, new product launches and exclusive offers!",
    footerNewsletterTitle: "Newsletter",
    footerPressLogos: ["Cosmopolitan", "Bazaar", "Vogue", "Elle"],
    footerShopLinks: [
      { label: "Swim Tops", url: "/products" },
      { label: "Swim Bottoms", url: "/products" },
      { label: "One Pieces", url: "/products" },
      { label: "Cover-ups", url: "/products" }
    ],
    newArrivalsDescription: "Discover the latest ready-to-wear dresses.",
    newArrivalsTitle: "New Arrivals",
    newsletterButtonText: "Subscribe",
    newsletterDescription: "New collections, campaign stories, and private offers from your store.",
    newsletterImageUrl: "",
    newsletterTitle: "Receive the next editorial drop."
  },
  productPage: {
    accordionEnabled: true,
    addToCartButtonColor: "#000000",
    addToCartButtonRadius: 0,
    addToCartText: "Add to Cart",
    breadcrumbEnabled: true,
    buyNowEnabled: false,
    galleryLayout: "two-column",
    gallerySpacing: 4,
    imageRatio: "portrait",
    lightboxEnabled: true,
    promoBlocksEnabled: true,
    shippingEnabled: true,
    shippingNotice: "Next day delivery available",
    variantEnabled: true,
    variantStyle: "buttons",
    zoomEnabled: true
  },
  shopPage: {
    defaultSort: "alpha-asc",
    description: "Everything in one place - from the ones you return to, to the ones worth trying for the first time. Find what belongs in your day.",
    descriptionEnabled: true,
    enableAvailabilityFilter: true,
    enableBrandFilter: true,
    enableCategoryFilter: true,
    enableColorFilter: true,
    enableCollectionFilter: true,
    enableComparePrice: true,
    enableFilters: true,
    enableHoverImage: true,
    enableProductBadges: true,
    enableProductBrand: true,
    enableProductColorCount: true,
    enablePriceFilter: true,
    enableQuickView: false,
    enableSizeFilter: true,
    enableSorting: true,
    enableTagFilter: true,
    enableResultCounter: true,
    gridSpacing: 4,
    paginationMode: "pagination",
    pageTitle: "Products",
    productsPerPage: 12,
    productsPerRow: 4,
    sectionSpacing: 72,
    sortOptions: ["featured", "newest", "best-selling", "price-asc", "price-desc", "alpha-asc", "alpha-desc"],
    widthMode: "full"
  },
  tabbedProductShowcase: {
    arrowsVisible: true,
    autoplay: false,
    backgroundColor: "#ffffff",
    defaultActiveTab: 0,
    description: "Footwear built around one idea: that the best shoes are the ones you stop noticing. Precise in form, deliberate in material.",
    enabled: true,
    fullWidth: true,
    infiniteLoop: false,
    productsPerTab: 5,
    productsPerView: 5,
    scrollAmount: "page",
    sectionSpacing: 84,
    sliderEnabled: true,
    tabs: [
      { enabled: true, label: "All", productCount: 5, source: "all" },
      { enabled: true, label: "Bestsellers", productCount: 5, source: "best-sellers" },
      { enabled: true, label: "On Sale", productCount: 5, source: "on-sale" },
      { enabled: true, label: "New In", productCount: 5, source: "new-arrivals" }
    ],
    title: ""
  }
};

export function normalizeAdvancedSettings(value: unknown): StorefrontAdvancedSettings {
  const input = isRecord(value) ? value : {};
  const announcement = isRecord(input.announcement) ? input.announcement : {};
  const header = isRecord(input.header) ? input.header : {};
  const hero = isRecord(input.hero) ? input.hero : {};
  const cartPage = isRecord(input.cartPage) ? input.cartPage : {};
  const miniCart = isRecord(input.miniCart) ? input.miniCart : {};
  const layout = isRecord(input.layout) ? input.layout : {};
  const productPage = isRecord(input.productPage) ? input.productPage : {};
  const shopPage = isRecord(input.shopPage) ? input.shopPage : {};
  const tabbedProductShowcase = isRecord(input.tabbedProductShowcase) ? input.tabbedProductShowcase : {};
  const electronics = isRecord(input.electronics) ? input.electronics : {};
  const fashion = isRecord(input.fashion) ? input.fashion : {};

  return {
    announcement: {
      ...DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement,
      backgroundColor: hex(announcement.backgroundColor, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.backgroundColor),
      enabled: bool(announcement.enabled, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.enabled),
      fontSize: numberInRange(announcement.fontSize, 10, 20, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.fontSize),
      messages: messageList(announcement.messages),
      scrollSpeed: oneOf(announcement.scrollSpeed, ["slow", "normal", "fast"], DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.scrollSpeed),
      textColor: hex(announcement.textColor, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.textColor)
    },
    header: {
      ...DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header,
      backgroundColor: hex(header.backgroundColor, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.backgroundColor),
      enabled: bool(header.enabled, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.enabled),
      height: numberInRange(header.height, 56, 140, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.height),
      logoText: text(header.logoText),
      menuItems: menuList(header.menuItems),
      showAccount: bool(header.showAccount, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.showAccount),
      showCart: bool(header.showCart, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.showCart),
      showCurrency: bool(header.showCurrency, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.showCurrency),
      showSearch: bool(header.showSearch, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.showSearch),
      spacing: numberInRange(header.spacing, 16, 96, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.spacing),
      sticky: bool(header.sticky, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.sticky),
      textColor: hex(header.textColor, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.textColor)
    },
    hero: {
      ...DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero,
      align: oneOf(hero.align, ["left", "center", "right"], DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.align),
      autoplay: bool(hero.autoplay, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.autoplay),
      button1Link: path(hero.button1Link, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.button1Link),
      button1Text: text(hero.button1Text, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.button1Text),
      button2Link: path(hero.button2Link, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.button2Link),
      button2Text: text(hero.button2Text, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.button2Text),
      buttonStyle: oneOf(hero.buttonStyle, ["filled", "outline", "light"], DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.buttonStyle),
      contentType: oneOf(hero.contentType, ["single-image", "image-slider", "single-video", "video-slider", "mixed-slider", "youtube"], DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.contentType),
      customHeight: optionalNumber(hero.customHeight, 320, 1000),
      customWidth: optionalNumber(hero.customWidth, 720, 1920),
      enabled: bool(hero.enabled, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.enabled),
      height: oneOf(hero.height, ["small", "medium", "large", "custom"], DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.height),
      imageUrl: text(hero.imageUrl),
      layoutWidth: oneOf(hero.layoutWidth, ["full", "boxed", "custom"], DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.layoutWidth),
      overlayColor: hex(hero.overlayColor, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.overlayColor),
      overlayOpacity: numberInRange(hero.overlayOpacity, 0, 90, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.overlayOpacity),
      showArrows: bool(hero.showArrows, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.showArrows),
      showDots: bool(hero.showDots, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.showDots),
      sliderSpeed: numberInRange(hero.sliderSpeed, 2000, 12000, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.sliderSpeed),
      slides: slideList(hero.slides),
      subtitle: text(hero.subtitle, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.subtitle),
      textColor: hex(hero.textColor, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.textColor),
      title: text(hero.title, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.title),
      videoUrl: text(hero.videoUrl),
      youtubeUrl: text(hero.youtubeUrl)
    },
    cartPage: cartPageSettings(cartPage),
    miniCart: miniCartSettings(miniCart),
    layout: {
      ...DEFAULT_STOREFRONT_ADVANCED_SETTINGS.layout,
      boxedMaxWidth: numberInRange(layout.boxedMaxWidth, 960, 1920, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.layout.boxedMaxWidth),
      pageBackgroundColor: hex(layout.pageBackgroundColor, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.layout.pageBackgroundColor),
      sectionPadding: numberInRange(layout.sectionPadding, 24, 120, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.layout.sectionPadding),
      widthMode: oneOf(layout.widthMode, ["full", "boxed"], DEFAULT_STOREFRONT_ADVANCED_SETTINGS.layout.widthMode)
    },
    productSections: {
      bestSellers: productSection(input.productSections, "bestSellers"),
      featured: productSection(input.productSections, "featured"),
      listing: productSection(input.productSections, "listing"),
      newArrivals: productSection(input.productSections, "newArrivals"),
      related: productSection(input.productSections, "related"),
      recentlyViewed: productSection(input.productSections, "recentlyViewed"),
      search: productSection(input.productSections, "search"),
      trending: productSection(input.productSections, "trending")
    },
    electronics: electronicsSettings(electronics),
    fashion: fashionSettings(fashion),
    productPage: productPageSettings(productPage),
    shopPage: shopPageSettings(shopPage),
    tabbedProductShowcase: tabbedProductShowcaseSettings(tabbedProductShowcase)
  };
}

function productPageSettings(input: Record<string, unknown>): StorefrontProductPageSettings {
  const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productPage;

  return {
    accordionEnabled: bool(input.accordionEnabled, defaults.accordionEnabled),
    addToCartButtonColor: hex(input.addToCartButtonColor, defaults.addToCartButtonColor),
    addToCartButtonRadius: numberInRange(input.addToCartButtonRadius, 0, 32, defaults.addToCartButtonRadius),
    addToCartText: text(input.addToCartText, defaults.addToCartText),
    breadcrumbEnabled: bool(input.breadcrumbEnabled, defaults.breadcrumbEnabled),
    buyNowEnabled: bool(input.buyNowEnabled, defaults.buyNowEnabled),
    galleryLayout: oneOf(input.galleryLayout, ["two-column", "vertical", "horizontal"], defaults.galleryLayout),
    gallerySpacing: numberInRange(input.gallerySpacing, 0, 32, defaults.gallerySpacing),
    imageRatio: oneOf(input.imageRatio, ["portrait", "square", "wide"], defaults.imageRatio),
    lightboxEnabled: bool(input.lightboxEnabled, defaults.lightboxEnabled),
    promoBlocksEnabled: bool(input.promoBlocksEnabled, defaults.promoBlocksEnabled),
    shippingEnabled: bool(input.shippingEnabled, defaults.shippingEnabled),
    shippingNotice: text(input.shippingNotice, defaults.shippingNotice),
    variantEnabled: bool(input.variantEnabled, defaults.variantEnabled),
    variantStyle: oneOf(input.variantStyle, ["buttons", "dropdown"], defaults.variantStyle),
    zoomEnabled: bool(input.zoomEnabled, defaults.zoomEnabled)
  };
}

function electronicsSettings(input: Record<string, unknown>): StorefrontElectronicsHomepageSettings {
  const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.electronics;

  return {
    brandSectionTitle: text(input.brandSectionTitle, defaults.brandSectionTitle),
    categorySectionTitle: text(input.categorySectionTitle, defaults.categorySectionTitle),
    featuredSectionTitle: text(input.featuredSectionTitle, defaults.featuredSectionTitle),
    flashDealEyebrow: text(input.flashDealEyebrow, defaults.flashDealEyebrow),
    flashDealTitle: text(input.flashDealTitle, defaults.flashDealTitle),
    footerCollectionLinks: linkSettings(input.footerCollectionLinks, defaults.footerCollectionLinks),
    footerInformationLinks: linkSettings(input.footerInformationLinks, defaults.footerInformationLinks),
    heroPromoCards: electronicsPromoCards(input.heroPromoCards, defaults.heroPromoCards, 3),
    newArrivalsTitle: text(input.newArrivalsTitle, defaults.newArrivalsTitle),
    newsletterDescription: text(input.newsletterDescription, defaults.newsletterDescription),
    newsletterTitle: text(input.newsletterTitle, defaults.newsletterTitle),
    promoCards: electronicsPromoCards(input.promoCards, defaults.promoCards, 5),
    promoSectionTitle: text(input.promoSectionTitle, defaults.promoSectionTitle),
    recommendedTitle: text(input.recommendedTitle, defaults.recommendedTitle),
    supportText: text(input.supportText, defaults.supportText),
    trustItems: trustItems(input.trustItems, defaults.trustItems)
  };
}

function electronicsPromoCards(
  value: unknown,
  defaults: StorefrontElectronicsPromoCardSettings[],
  max: number
) {
  if (!Array.isArray(value)) {
    return defaults;
  }

  const cards = value
    .map((item, index): StorefrontElectronicsPromoCardSettings | null => {
      if (!isRecord(item)) {
        return null;
      }

      const fallback = defaults[index] ?? defaults[0]!;
      const title = text(item.title, fallback.title);

      if (!title) {
        return null;
      }

      return {
        backgroundColor: hex(item.backgroundColor, fallback.backgroundColor),
        badge: text(item.badge, fallback.badge),
        ctaLink: path(item.ctaLink, fallback.ctaLink),
        ctaText: text(item.ctaText, fallback.ctaText),
        description: text(item.description, fallback.description),
        imageUrl: text(item.imageUrl, fallback.imageUrl),
        title
      };
    })
    .filter((item): item is StorefrontElectronicsPromoCardSettings => Boolean(item));

  return cards.length > 0 ? cards.slice(0, max) : defaults;
}

function fashionSettings(input: Record<string, unknown>): StorefrontFashionHomepageSettings {
  const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.fashion;

  return {
    beforeAfterAfterImageUrl: text(input.beforeAfterAfterImageUrl, defaults.beforeAfterAfterImageUrl),
    beforeAfterAfterLabel: text(input.beforeAfterAfterLabel, defaults.beforeAfterAfterLabel),
    beforeAfterBeforeImageUrl: text(input.beforeAfterBeforeImageUrl, defaults.beforeAfterBeforeImageUrl),
    beforeAfterBeforeLabel: text(input.beforeAfterBeforeLabel, defaults.beforeAfterBeforeLabel),
    beforeAfterInitialPosition: numberInRange(input.beforeAfterInitialPosition, 10, 90, defaults.beforeAfterInitialPosition),
    collectionCtas: textList(input.collectionCtas, defaults.collectionCtas, 8),
    communityDescription: text(input.communityDescription, defaults.communityDescription),
    communityImages: textList(input.communityImages, defaults.communityImages, 12),
    communityTitle: text(input.communityTitle, defaults.communityTitle),
    editorialBannerCtaLink: path(input.editorialBannerCtaLink, defaults.editorialBannerCtaLink),
    editorialBannerCtaText: text(input.editorialBannerCtaText, defaults.editorialBannerCtaText),
    editorialBannerImageUrl: text(input.editorialBannerImageUrl, defaults.editorialBannerImageUrl),
    editorialBannerSubtitle: text(input.editorialBannerSubtitle, defaults.editorialBannerSubtitle),
    editorialBannerTitle: text(input.editorialBannerTitle, defaults.editorialBannerTitle),
    editorialSplitCtaLink: path(input.editorialSplitCtaLink, defaults.editorialSplitCtaLink),
    editorialSplitCtaText: text(input.editorialSplitCtaText, defaults.editorialSplitCtaText),
    editorialSplitHeading: text(input.editorialSplitHeading, defaults.editorialSplitHeading),
    editorialSplitHeight: numberInRange(input.editorialSplitHeight, 360, 1000, defaults.editorialSplitHeight),
    editorialSplitLeftImageUrl: text(input.editorialSplitLeftImageUrl, defaults.editorialSplitLeftImageUrl),
    editorialSplitOverlayOpacity: numberInRange(input.editorialSplitOverlayOpacity, 0, 80, defaults.editorialSplitOverlayOpacity),
    editorialSplitRightImageUrl: text(input.editorialSplitRightImageUrl, defaults.editorialSplitRightImageUrl),
    featuredLookCtaLink: path(input.featuredLookCtaLink, defaults.featuredLookCtaLink),
    featuredLookCtaText: text(input.featuredLookCtaText, defaults.featuredLookCtaText),
    featuredLookDescription: text(input.featuredLookDescription, defaults.featuredLookDescription),
    featuredLookImageUrl: text(input.featuredLookImageUrl, defaults.featuredLookImageUrl),
    featuredLookTitle: text(input.featuredLookTitle, defaults.featuredLookTitle),
    footerAboutLinks: linkSettings(input.footerAboutLinks, defaults.footerAboutLinks),
    footerDescription: text(input.footerDescription, defaults.footerDescription),
    footerLegalLinks: linkSettings(input.footerLegalLinks, defaults.footerLegalLinks),
    footerNewsletterDescription: text(input.footerNewsletterDescription, defaults.footerNewsletterDescription),
    footerNewsletterTitle: text(input.footerNewsletterTitle, defaults.footerNewsletterTitle),
    footerPressLogos: textList(input.footerPressLogos, defaults.footerPressLogos, 10),
    footerShopLinks: linkSettings(input.footerShopLinks, defaults.footerShopLinks),
    newArrivalsDescription: text(input.newArrivalsDescription, defaults.newArrivalsDescription),
    newArrivalsTitle: text(input.newArrivalsTitle, defaults.newArrivalsTitle),
    newsletterButtonText: text(input.newsletterButtonText, defaults.newsletterButtonText),
    newsletterDescription: text(input.newsletterDescription, defaults.newsletterDescription),
    newsletterImageUrl: text(input.newsletterImageUrl, defaults.newsletterImageUrl),
    newsletterTitle: text(input.newsletterTitle, defaults.newsletterTitle)
  };
}

function linkSettings(value: unknown, defaults: StorefrontLinkSetting[]) {
  if (!Array.isArray(value)) {
    return defaults;
  }

  const links = value
    .map((item): StorefrontLinkSetting | null => {
      if (!isRecord(item)) {
        return null;
      }

      const label = text(item.label);

      if (!label) {
        return null;
      }

      return {
        label,
        url: path(item.url, "/")
      };
    })
    .filter((item): item is StorefrontLinkSetting => Boolean(item));

  return links.length > 0 ? links.slice(0, 12) : defaults;
}

function textList(value: unknown, defaults: string[], max: number) {
  if (!Array.isArray(value)) {
    return defaults;
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items.slice(0, max) : defaults;
}

function trustItems(value: unknown, defaults: StorefrontElectronicsHomepageSettings["trustItems"]) {
  if (!Array.isArray(value)) {
    return defaults;
  }

  const items = value
    .map((item): StorefrontElectronicsHomepageSettings["trustItems"][number] | null => {
      if (!isRecord(item)) {
        return null;
      }

      const title = text(item.title);

      if (!title) {
        return null;
      }

      return {
        description: text(item.description),
        title
      };
    })
    .filter((item): item is StorefrontElectronicsHomepageSettings["trustItems"][number] => Boolean(item));

  return items.length > 0 ? items.slice(0, 6) : defaults;
}

function miniCartSettings(input: Record<string, unknown>): StorefrontMiniCartSettings {
  const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.miniCart;

  return {
    autoOpenAfterAdd: bool(input.autoOpenAfterAdd, defaults.autoOpenAfterAdd),
    checkoutButtonBackgroundColor: hex(input.checkoutButtonBackgroundColor, defaults.checkoutButtonBackgroundColor),
    checkoutButtonBorderRadius: numberInRange(input.checkoutButtonBorderRadius, 0, 32, defaults.checkoutButtonBorderRadius),
    checkoutButtonEnabled: bool(input.checkoutButtonEnabled, defaults.checkoutButtonEnabled),
    checkoutButtonText: text(input.checkoutButtonText, defaults.checkoutButtonText),
    checkoutButtonTextColor: hex(input.checkoutButtonTextColor, defaults.checkoutButtonTextColor),
    drawerWidth: numberInRange(input.drawerWidth, 320, 560, defaults.drawerWidth),
    enabled: bool(input.enabled, defaults.enabled),
    freeShippingAmount: numberInRange(input.freeShippingAmount, 0, 1000000, defaults.freeShippingAmount),
    freeShippingCtaLink: path(input.freeShippingCtaLink, defaults.freeShippingCtaLink),
    freeShippingCtaText: text(input.freeShippingCtaText, defaults.freeShippingCtaText),
    freeShippingEnabled: bool(input.freeShippingEnabled, defaults.freeShippingEnabled),
    freeShippingText: text(input.freeShippingText, defaults.freeShippingText),
    orderNotesEnabled: bool(input.orderNotesEnabled, defaults.orderNotesEnabled),
    overlayOpacity: numberInRange(input.overlayOpacity, 0, 90, defaults.overlayOpacity),
    showBrand: bool(input.showBrand, defaults.showBrand),
    showItemCount: bool(input.showItemCount, defaults.showItemCount),
    showQuantity: bool(input.showQuantity, defaults.showQuantity),
    showRemoveButton: bool(input.showRemoveButton, defaults.showRemoveButton),
    showVariant: bool(input.showVariant, defaults.showVariant),
    viewCartButtonEnabled: bool(input.viewCartButtonEnabled, defaults.viewCartButtonEnabled),
    viewCartButtonLink: path(input.viewCartButtonLink, defaults.viewCartButtonLink),
    viewCartButtonText: text(input.viewCartButtonText, defaults.viewCartButtonText)
  };
}

function cartPageSettings(input: Record<string, unknown>): StorefrontCartPageSettings {
  const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.cartPage;

  return {
    breadcrumbEnabled: bool(input.breadcrumbEnabled, defaults.breadcrumbEnabled),
    checkoutButtonBackgroundColor: hex(input.checkoutButtonBackgroundColor, defaults.checkoutButtonBackgroundColor),
    checkoutButtonBorderRadius: numberInRange(input.checkoutButtonBorderRadius, 0, 32, defaults.checkoutButtonBorderRadius),
    checkoutButtonText: text(input.checkoutButtonText, defaults.checkoutButtonText),
    checkoutButtonTextColor: hex(input.checkoutButtonTextColor, defaults.checkoutButtonTextColor),
    continueShoppingLink: path(input.continueShoppingLink, defaults.continueShoppingLink),
    estimatedDeliveryEnabled: bool(input.estimatedDeliveryEnabled, defaults.estimatedDeliveryEnabled),
    freeShippingAmount: numberInRange(input.freeShippingAmount, 0, 1000000, defaults.freeShippingAmount),
    freeShippingCtaLink: path(input.freeShippingCtaLink, defaults.freeShippingCtaLink),
    freeShippingCtaText: text(input.freeShippingCtaText, defaults.freeShippingCtaText),
    freeShippingEnabled: bool(input.freeShippingEnabled, defaults.freeShippingEnabled),
    freeShippingText: text(input.freeShippingText, defaults.freeShippingText),
    orderNotesEnabled: bool(input.orderNotesEnabled, defaults.orderNotesEnabled),
    showBrand: bool(input.showBrand, defaults.showBrand),
    showRemoveButton: bool(input.showRemoveButton, defaults.showRemoveButton),
    showVariant: bool(input.showVariant, defaults.showVariant),
    taxesEnabled: bool(input.taxesEnabled, defaults.taxesEnabled),
    widthMode: oneOf(input.widthMode, ["full", "boxed"], defaults.widthMode)
  };
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function hex(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function menuList(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.menuItems;
  }

  const items = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const label = text(item.label);
      const url = path(item.url, "/");

      return label ? { label, url } : null;
    })
    .filter((item): item is StorefrontMenuItem => Boolean(item));

  return items.length > 0 ? items.slice(0, 12) : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.menuItems;
}

function messageList(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.messages;
  }

  const messages = value
    .map((item): StorefrontMessage | null => {
      if (!isRecord(item)) {
        return null;
      }

      const message = text(item.text);

      if (!message) {
        return null;
      }

      const link = text(item.link);

      return link ? { link, text: message } : { text: message };
    })
    .filter((item): item is StorefrontMessage => Boolean(item));

  return messages.length > 0 ? messages.slice(0, 12) : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.messages;
}

function numberInRange(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? Math.min(max, Math.max(min, numberValue)) : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function optionalNumber(value: unknown, min: number, max: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : undefined;
}

function path(value: unknown, fallback: string) {
  const stringValue = text(value);

  if (!stringValue) {
    return fallback;
  }

  return stringValue.startsWith("/") || stringValue.startsWith("http") ? stringValue : `/${stringValue}`;
}

function slideList(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.slides;
  }

  const slides = value
    .map((item): StorefrontHeroSlide | null => {
      if (!isRecord(item)) {
        return null;
      }

      const url = text(item.url);

      if (!url) {
        return null;
      }

      const slide: StorefrontHeroSlide = {
        mediaType: oneOf(item.mediaType, ["image", "video", "youtube"], "image"),
        url
      };

      const slideTitle = text(item.title);
      const slideSubtitle = text(item.subtitle);

      if (slideTitle) {
        slide.title = slideTitle;
      }

      if (slideSubtitle) {
        slide.subtitle = slideSubtitle;
      }

      return slide;
    })
    .filter((item): item is StorefrontHeroSlide => Boolean(item));

  return slides.length > 0 ? slides.slice(0, 8) : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.slides;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function productSection(
  sections: unknown,
  key: keyof StorefrontAdvancedSettings["productSections"]
): StorefrontProductSectionSettings {
  const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections[key];
  const record = isRecord(sections) && isRecord(sections[key]) ? sections[key] : {};
  const columns = Math.round(numberInRange(record.columns, 2, 5, defaults.columns)) as 2 | 3 | 4 | 5;

  return {
    columns,
    count: numberInRange(record.count, 1, 24, defaults.count),
    ctaLink: path(record.ctaLink, defaults.ctaLink),
    ctaText: text(record.ctaText, defaults.ctaText),
    enableBadges: bool(record.enableBadges, defaults.enableBadges),
    enableComparePrice: bool(record.enableComparePrice, defaults.enableComparePrice),
    enableHoverImage: bool(record.enableHoverImage, defaults.enableHoverImage),
    enableVariants: bool(record.enableVariants, defaults.enableVariants),
    mode: oneOf(record.mode, ["grid", "slider"], defaults.mode),
    source: oneOf(record.source, ["manual", "featured", "best-sellers", "new-arrivals", "trending", "related", "search", "recently-viewed"], defaults.source),
    subtitle: text(record.subtitle, defaults.subtitle),
    title: text(record.title, defaults.title)
  };
}

function productSectionDefault(input: Partial<StorefrontProductSectionSettings>): StorefrontProductSectionSettings {
  return {
    columns: 4,
    count: 4,
    ctaLink: "/products",
    ctaText: "Shop Now",
    enableBadges: true,
    enableComparePrice: true,
    enableHoverImage: true,
    enableVariants: true,
    mode: "grid",
    source: "featured",
    subtitle: "",
    title: "Products",
    ...input
  };
}

function tabbedProductShowcaseSettings(input: Record<string, unknown>): StorefrontTabbedProductShowcaseSettings {
  const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.tabbedProductShowcase;
  const productsPerView = Math.round(numberInRange(input.productsPerView, 2, 5, defaults.productsPerView)) as 2 | 3 | 4 | 5;
  const tabs = tabbedProductTabs(input.tabs);

  return {
    arrowsVisible: bool(input.arrowsVisible, defaults.arrowsVisible),
    autoplay: bool(input.autoplay, defaults.autoplay),
    backgroundColor: hex(input.backgroundColor, defaults.backgroundColor),
    defaultActiveTab: Math.round(numberInRange(input.defaultActiveTab, 0, Math.max(tabs.length - 1, 0), defaults.defaultActiveTab)),
    description: text(input.description, defaults.description),
    enabled: bool(input.enabled, defaults.enabled),
    fullWidth: bool(input.fullWidth, defaults.fullWidth),
    infiniteLoop: bool(input.infiniteLoop, defaults.infiniteLoop),
    productsPerTab: numberInRange(input.productsPerTab, 1, 20, defaults.productsPerTab),
    productsPerView,
    scrollAmount: oneOf(input.scrollAmount, ["one", "page"], defaults.scrollAmount),
    sectionSpacing: numberInRange(input.sectionSpacing, 32, 140, defaults.sectionSpacing),
    sliderEnabled: bool(input.sliderEnabled, defaults.sliderEnabled),
    tabs,
    title: text(input.title, defaults.title)
  };
}

function tabbedProductTabs(value: unknown): StorefrontTabbedProductTab[] {
  const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.tabbedProductShowcase.tabs;

  if (!Array.isArray(value)) {
    return defaults;
  }

  const tabs = value
    .map((item): StorefrontTabbedProductTab | null => {
      if (!isRecord(item)) {
        return null;
      }

      const label = text(item.label);

      if (!label) {
        return null;
      }

      return {
        enabled: bool(item.enabled, true),
        label,
        productCount: numberInRange(item.productCount, 1, 20, DEFAULT_STOREFRONT_ADVANCED_SETTINGS.tabbedProductShowcase.productsPerTab),
        source: oneOf(
          item.source,
          ["all", "featured", "best-sellers", "new-arrivals", "on-sale", "category", "collection", "manual"],
          "all"
        )
      };
    })
    .filter((item): item is StorefrontTabbedProductTab => Boolean(item));

  return tabs.length > 0 ? tabs.slice(0, 8) : defaults;
}

function shopPageSettings(input: Record<string, unknown>): StorefrontShopPageSettings {
  const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.shopPage;
  const productsPerRow = Math.round(numberInRange(input.productsPerRow, 2, 4, defaults.productsPerRow)) as 2 | 3 | 4;
  const sortOptions = shopSortOptions(input.sortOptions);

  return {
    defaultSort: oneOf(input.defaultSort, sortOptions, defaults.defaultSort),
    description: text(input.description, defaults.description),
    descriptionEnabled: bool(input.descriptionEnabled, defaults.descriptionEnabled),
    enableAvailabilityFilter: bool(input.enableAvailabilityFilter, defaults.enableAvailabilityFilter),
    enableBrandFilter: bool(input.enableBrandFilter, defaults.enableBrandFilter),
    enableCategoryFilter: bool(input.enableCategoryFilter, defaults.enableCategoryFilter),
    enableColorFilter: bool(input.enableColorFilter, defaults.enableColorFilter),
    enableCollectionFilter: bool(input.enableCollectionFilter, defaults.enableCollectionFilter),
    enableComparePrice: bool(input.enableComparePrice, defaults.enableComparePrice),
    enableFilters: bool(input.enableFilters, defaults.enableFilters),
    enableHoverImage: bool(input.enableHoverImage, defaults.enableHoverImage),
    enableProductBadges: bool(input.enableProductBadges, defaults.enableProductBadges),
    enableProductBrand: bool(input.enableProductBrand, defaults.enableProductBrand),
    enableProductColorCount: bool(input.enableProductColorCount, defaults.enableProductColorCount),
    enablePriceFilter: bool(input.enablePriceFilter, defaults.enablePriceFilter),
    enableQuickView: bool(input.enableQuickView, defaults.enableQuickView),
    enableSizeFilter: bool(input.enableSizeFilter, defaults.enableSizeFilter),
    enableSorting: bool(input.enableSorting, defaults.enableSorting),
    enableTagFilter: bool(input.enableTagFilter, defaults.enableTagFilter),
    enableResultCounter: bool(input.enableResultCounter, defaults.enableResultCounter),
    gridSpacing: numberInRange(input.gridSpacing, 0, 36, defaults.gridSpacing),
    paginationMode: oneOf(input.paginationMode, ["pagination", "load-more"], defaults.paginationMode),
    pageTitle: text(input.pageTitle, defaults.pageTitle),
    productsPerPage: numberInRange(input.productsPerPage, 4, 48, defaults.productsPerPage),
    productsPerRow,
    sectionSpacing: numberInRange(input.sectionSpacing, 32, 140, defaults.sectionSpacing),
    sortOptions,
    widthMode: oneOf(input.widthMode, ["full", "boxed", "custom"], defaults.widthMode)
  };
}

function shopSortOptions(value: unknown): StorefrontShopPageSortOption[] {
  const defaults = DEFAULT_STOREFRONT_ADVANCED_SETTINGS.shopPage.sortOptions;

  if (!Array.isArray(value)) {
    return defaults;
  }

  const options = value.filter((item): item is StorefrontShopPageSortOption =>
    typeof item === "string" &&
    ["featured", "newest", "best-selling", "price-asc", "price-desc", "alpha-asc", "alpha-desc"].includes(item)
  );

  return options.length > 0 ? Array.from(new Set(options)) : defaults;
}
