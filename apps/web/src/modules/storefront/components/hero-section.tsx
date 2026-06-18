import Link from "next/link";
import type { StorefrontStore } from "../storefront.types";

type HeroSectionProps = {
  primaryDomain: string | undefined;
  store: StorefrontStore;
};

export function HeroSection({ primaryDomain, store }: HeroSectionProps) {
  return (
    <section className="sf-hero" aria-labelledby="storefront-title">
      <p>{primaryDomain ?? `${store.slug}.dash.com`}</p>
      <h1 id="storefront-title">Discover what is new at {store.name}</h1>
      <span>
        A modern storefront powered by Dash Commerce OS. Browse selected products, categories, and
        new arrivals from this store.
      </span>
      <Link className="sf-button" href={`/s/${store.slug}/products`}>
        Shop products
      </Link>
    </section>
  );
}
