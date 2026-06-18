import Link from "next/link";
import type { StorefrontStore } from "../storefront.types";

type HeroSectionProps = {
  primaryDomain: string | undefined;
  store: StorefrontStore;
};

export function HeroSection({ primaryDomain, store }: HeroSectionProps) {
  const theme = store.themeSetting;
  const heroTitle = theme?.heroTitle || `Discover what is new at ${store.name}`;
  const heroSubtitle =
    theme?.heroSubtitle ||
    "Browse selected products, categories, and new arrivals from this store.";

  return (
    <section
      className={theme?.heroImageUrl ? "sf-hero with-media" : "sf-hero"}
      aria-labelledby="storefront-title"
    >
      {theme?.announcementText ? (
        <div className="sf-announcement">{theme.announcementText}</div>
      ) : null}
      <div>
        <p>{primaryDomain ?? `${store.slug}.dash.com`}</p>
        <h1 id="storefront-title">{heroTitle}</h1>
        <span>{heroSubtitle}</span>
        <Link className="sf-button" href={`/s/${store.slug}/products`}>
          Shop products
        </Link>
      </div>
      {theme?.heroImageUrl ? (
        <div className="sf-hero-media">
          <img alt={`${store.name} storefront hero`} src={theme.heroImageUrl} />
        </div>
      ) : null}
    </section>
  );
}
