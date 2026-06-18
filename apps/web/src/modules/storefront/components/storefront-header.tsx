import Link from "next/link";
import type { StorefrontStore } from "../storefront.types";

type StorefrontHeaderProps = {
  store: StorefrontStore;
};

export function StorefrontHeader({ store }: StorefrontHeaderProps) {
  const homeHref = `/s/${store.slug}`;

  return (
    <header className="sf-header">
      <Link className="sf-brand" href={homeHref}>
        <span>{store.name.slice(0, 1).toUpperCase()}</span>
        {store.name}
      </Link>
      <nav className="sf-nav" aria-label="Storefront navigation">
        <Link href={homeHref}>Home</Link>
        <Link href={`${homeHref}/products`}>Shop</Link>
      </nav>
    </header>
  );
}
