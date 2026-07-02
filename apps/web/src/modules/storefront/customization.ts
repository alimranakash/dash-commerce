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
  columns: 2 | 3 | 4;
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
  layout: {
    boxedMaxWidth: 1440,
    pageBackgroundColor: "#ffffff",
    sectionPadding: 64,
    widthMode: "full"
  },
  productSections: {
    bestSellers: productSectionDefault({
      ctaText: "View all",
      source: "best-sellers",
      subtitle: "Customer favorites selected from the public catalog.",
      title: "Best Sellers"
    }),
    featured: productSectionDefault({
      ctaText: "Shop Now",
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
      source: "new-arrivals",
      subtitle: "Freshly added products from the latest catalog update.",
      title: "New Arrivals"
    }),
    related: productSectionDefault({
      count: 4,
      ctaText: "View all",
      source: "related",
      subtitle: "More products selected from the same collection.",
      title: "You may also like"
    }),
    recentlyViewed: productSectionDefault({
      count: 4,
      ctaText: "View all",
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
      source: "trending",
      subtitle: "A refined selection of products getting attention now.",
      title: "Trending Products"
    })
  }
};

export function normalizeAdvancedSettings(value: unknown): StorefrontAdvancedSettings {
  const input = isRecord(value) ? value : {};
  const announcement = isRecord(input.announcement) ? input.announcement : {};
  const header = isRecord(input.header) ? input.header : {};
  const hero = isRecord(input.hero) ? input.hero : {};
  const layout = isRecord(input.layout) ? input.layout : {};

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
    }
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
  const columns = Math.round(numberInRange(record.columns, 2, 4, defaults.columns)) as 2 | 3 | 4;

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
