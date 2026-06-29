import Link from "next/link";
import type { ReactNode } from "react";
import { ProductCard } from "../../components/product-card";
import type { StorefrontProduct } from "../../storefront.types";

type SectionWrapperProps = {
  children: ReactNode;
  eyebrow?: string;
  id?: string;
  title: string;
};

export function GeneralSectionWrapper({ children, eyebrow, id, title }: SectionWrapperProps) {
  return (
    <section className="sf-section general-section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="sf-section-heading">
        <div>
          {eyebrow ? <p>{eyebrow}</p> : null}
          <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export function GeneralProductGrid({
  currency,
  emptyText,
  emptyTitle,
  products,
  storeSlug
}: {
  currency: string;
  emptyText: string;
  emptyTitle: string;
  products: StorefrontProduct[];
  storeSlug: string;
}) {
  if (products.length === 0) {
    return (
      <div className="sf-empty">
        <h3>{emptyTitle}</h3>
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="sf-product-grid">
      {products.map((product) => (
        <ProductCard currency={currency} key={product.id} product={product} storeSlug={storeSlug} />
      ))}
    </div>
  );
}

export function GeneralPromoBanner({ storeSlug }: { storeSlug: string }) {
  return (
    <section className="sf-section general-promo-banner" aria-labelledby="general-promo-title">
      <div>
        <p>Limited collection</p>
        <h2 id="general-promo-title">Everyday essentials, ready to ship</h2>
        <span>Highlight new launches, seasonal offers, or popular bundles from this flexible banner.</span>
      </div>
      <Link className="sf-button" href={`/s/${storeSlug}/products`}>
        Shop the catalog
      </Link>
    </section>
  );
}

export function GeneralFooterCta({ storeName, storeSlug }: { storeName: string; storeSlug: string }) {
  return (
    <section className="sf-section general-footer-cta" aria-labelledby="general-footer-cta-title">
      <p>Ready when you are</p>
      <h2 id="general-footer-cta-title">Explore everything {storeName} has in store.</h2>
      <Link className="sf-button" href={`/s/${storeSlug}/products`}>
        Continue shopping
      </Link>
    </section>
  );
}
