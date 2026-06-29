import { CategorySection } from "../components/category-section";
import { FeaturedProducts } from "../components/featured-products";
import { HeroSection } from "../components/hero-section";
import { NewsletterCta } from "../components/newsletter-cta";
import { ProductCard } from "../components/product-card";
import { TrustBadges } from "../components/trust-badges";
import type {
  StorefrontTemplateHomepageProps,
  StorefrontTemplatePlaceholderProps,
  StorefrontTemplateProductCardProps
} from "./types";

type TemplateAccentProps = {
  description: string;
  label: string;
  tone: {
    background: string;
    border: string;
    color: string;
  };
};

export function TemplateAccent({ description, label, tone }: TemplateAccentProps) {
  return (
    <section
      className="sf-section"
      style={{
        background: tone.background,
        border: `1px solid ${tone.border}`,
        color: tone.color
      }}
    >
      <div className="sf-section-heading">
        <p>Template</p>
        <h2>{label}</h2>
      </div>
      <p>{description}</p>
    </section>
  );
}

export function TemplateHomepageBase({
  accent,
  homeData,
  primaryDomain,
  store
}: StorefrontTemplateHomepageProps & {
  accent: TemplateAccentProps;
}) {
  return (
    <>
      <TemplateAccent {...accent} />
      <HeroSection primaryDomain={primaryDomain} store={store} />
      <CategorySection categories={homeData.categories} storeSlug={store.slug} />
      <FeaturedProducts
        currency={store.currency}
        heading={store.themeSetting?.featuredSectionTitle}
        products={homeData.featuredProducts}
        storeSlug={store.slug}
      />
      <TrustBadges />
      <NewsletterCta />
    </>
  );
}

export function TemplateProductCardBase({
  currency,
  product,
  storeSlug,
  variant
}: StorefrontTemplateProductCardProps & {
  variant: string;
}) {
  return (
    <div data-storefront-product-card-variant={variant}>
      <ProductCard currency={currency} product={product} storeSlug={storeSlug} />
    </div>
  );
}

export function TemplateLayoutPlaceholder({
  label,
  store,
  type
}: StorefrontTemplatePlaceholderProps & {
  label: string;
  type: "category" | "product";
}) {
  return (
    <section className="sf-section" data-storefront-template-placeholder={type}>
      <div className="sf-empty">
        <h3>{label}</h3>
        <p>{store.name} will use this {type} layout when the template-specific page is enabled.</p>
      </div>
    </section>
  );
}
