import { getDemoPackForBusinessType } from "../demo-packs/registry";
import type { DemoPack } from "../demo-packs/types";
import {
  getTemplateIdForBusinessType,
  storefrontTemplateNames,
  type StorefrontTemplateId
} from "../storefront/templates/template-mapping";
import { businessTypes, type BusinessType } from "./options";

/**
 * What the wizard's preview panel draws, per business type.
 *
 * The panel used to render one hardcoded beige storefront for all four answers,
 * so the Business Type step changed nothing a seller could see. Every field here
 * is read from the demo pack that `createOnboardingWorkspace` actually seeds for
 * that answer — the same hero image, hero copy, colours, categories and products
 * the store opens with — so the preview is a description of the outcome rather
 * than an illustration next to it. Nothing is authored twice: a pack that
 * changes its hero changes this panel with it.
 *
 * Built on the server and handed down as a prop, because the four packs
 * together are several thousand lines of catalogue data that has no business
 * being in a registration page's JavaScript bundle.
 */
export type StorePreviewProduct = {
  compareAtPrice: string | null;
  imageAlt: string;
  imageUrl: string;
  price: string;
  title: string;
};

export type StorePreviewDesign = {
  categoryCount: number;
  ctaText: string;
  featuredTitle: string;
  heroImageUrl: string | null;
  heroSubtitle: string | null;
  heroTitle: string;
  navLabels: string[];
  primaryColor: string;
  productCount: number;
  products: StorePreviewProduct[];
  secondaryColor: string | null;
  tagline: string | null;
  templateId: StorefrontTemplateId;
  templateName: string;
};

export type StorePreviewDesigns = Record<BusinessType, StorePreviewDesign>;

/** How many cards the product strip under the hero can show without scrolling. */
const previewProductCount = 3;

/** How many links the mock's navigation bar can show before it wraps. */
const previewNavCount = 4;

export function buildStorePreviewDesign(businessType: BusinessType): StorePreviewDesign {
  const demoPack = getDemoPackForBusinessType(businessType);
  const templateId = getTemplateIdForBusinessType(businessType);
  const { homepage, settings } = demoPack.content;

  return {
    categoryCount: demoPack.content.categories.length,
    ctaText: homepage.ctaText ?? "Shop all products",
    featuredTitle: homepage.featuredSectionTitle ?? "Featured products",
    heroImageUrl: homepage.heroImageUrl ?? null,
    heroSubtitle: homepage.heroSubtitle ?? null,
    heroTitle: homepage.heroTitle ?? "Discover quality products for everyday life",
    navLabels: demoPack.content.navigation.slice(0, previewNavCount).map((item) => item.label),
    primaryColor: settings.primaryColor ?? "#135d66",
    productCount: demoPack.content.products.length,
    products: pickPreviewProducts(demoPack),
    secondaryColor: settings.secondaryColor ?? null,
    tagline: settings.storeTagline ?? null,
    templateId,
    templateName: storefrontTemplateNames[templateId]
  };
}

export const storePreviewDesigns = Object.fromEntries(
  businessTypes.map((businessType) => [businessType, buildStorePreviewDesign(businessType)])
) as StorePreviewDesigns;

/**
 * One product per category, in pack order.
 *
 * Taking the first three outright would show three dresses or three serums,
 * which reads as a narrow shop rather than the catalogue the seller is being
 * given. Falls back to pack order when a pack has fewer categories than slots.
 */
function pickPreviewProducts(demoPack: DemoPack): StorePreviewProduct[] {
  const seenCategories = new Set<string>();
  const picked = demoPack.content.products.filter((product) => {
    if (seenCategories.has(product.categorySlug)) {
      return false;
    }

    seenCategories.add(product.categorySlug);

    return true;
  });
  const products = picked.length >= previewProductCount ? picked : demoPack.content.products;

  return products.slice(0, previewProductCount).map((product) => ({
    compareAtPrice: product.compareAtPrice ?? null,
    imageAlt: product.imageAlt,
    imageUrl: product.imageUrl,
    price: product.price,
    title: product.title
  }));
}
