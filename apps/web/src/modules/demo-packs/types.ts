export type DemoPackBusinessType = "Cosmetics & Beauty" | "Electronics" | "Fashion" | "General Store";

export type DemoPackCategory = {
  description?: string;
  name: string;
  slug: string;
};

export type DemoPackProduct = {
  categorySlug: string;
  compareAtPrice?: string | undefined;
  description: string;
  imageAlt: string;
  imageUrl: string;
  price: string;
  shortDescription: string;
  sku: string;
  slug: string;
  stockQuantity: number;
  title: string;
};

export type DemoPackHomepage = {
  ctaText?: string;
  beautyTipsTitle?: string;
  bestSellersTitle?: string;
  editorialBannerText?: string;
  featuredBrandsTitle?: string;
  featuredGadgetsTitle?: string;
  featuredSectionTitle?: string;
  flashDealsTitle?: string;
  heroSubtitle?: string;
  heroTitle?: string;
  newCollectionTitle?: string;
  newsletterText?: string;
  promoBannerText?: string;
  shopByConcernTitle?: string;
  trendingProductsTitle?: string;
};

export type DemoPackNavigationItem = {
  href: string;
  label: string;
};

export type DemoPackSettings = {
  announcementText?: string;
  primaryColor?: string;
  secondaryColor?: string;
  storeTagline?: string;
};

export type DemoPackContent = {
  categories: DemoPackCategory[];
  collections: unknown[];
  homepage: DemoPackHomepage;
  media: unknown[];
  navigation: DemoPackNavigationItem[];
  pages: unknown[];
  products: DemoPackProduct[];
  settings: DemoPackSettings;
};

export type DemoPack = {
  businessType: DemoPackBusinessType;
  compatibleTemplate: string;
  content: DemoPackContent;
  description: string;
  id: string;
  name: string;
  version: string;
};

export type DemoPackSeedContext = {
  demoPackId: string;
  organizationId: string;
  storeId: string;
};
