import { storefrontBasePath } from "../base-path";
import Link from "next/link";
import type { StorefrontStore } from "../storefront.types";
import { storeSubdomain } from "../../../lib/host-routing";

type HeroSectionProps = {
  primaryDomain: string | undefined;
  store: StorefrontStore;
};

export async function HeroSection({ primaryDomain, store }: HeroSectionProps) {
  const basePath = await storefrontBasePath(store.slug);
  const theme = store.themeSetting;
  const heroTitle = theme?.heroTitle || "Discover products you'll love";
  const heroSubtitle =
    theme?.heroSubtitle ||
    store.setting?.tagline ||
    `Shop quality products from ${store.name} with fast delivery and secure checkout.`;

  return (
    <section
      className={theme?.heroImageUrl ? "sf-hero with-media" : "sf-hero"}
      aria-labelledby="storefront-title"
    >
      <div>
        <p>{primaryDomain ?? storeSubdomain(store.slug)}</p>
        <h1 id="storefront-title">{heroTitle}</h1>
        <span>{heroSubtitle}</span>
        <div className="sf-hero-actions">
          <Link className="sf-button" href={`${basePath}/products`}>
            Shop Now
          </Link>
          <a className="sf-button sf-button-secondary" href="#featured-categories">
            View Categories
          </a>
        </div>
      </div>
      {theme?.heroImageUrl ? (
        <div className="sf-hero-media">
          <img alt={`${store.name} storefront hero`} src={theme.heroImageUrl} />
        </div>
      ) : null}
    </section>
  );
}
