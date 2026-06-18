import Link from "next/link";
import { getCart } from "../../cart/cart.service";
import type { StorefrontStore } from "../storefront.types";

type StorefrontHeaderProps = {
  store: StorefrontStore;
};

export async function StorefrontHeader({ store }: StorefrontHeaderProps) {
  const homeHref = `/s/${store.slug}`;
  const cart = await getCart(store.id);

  return (
    <header className="sf-header">
      <Link className="sf-brand" href={homeHref}>
        <span>{store.name.slice(0, 1).toUpperCase()}</span>
        {store.name}
      </Link>
      <nav className="sf-nav" aria-label="Storefront navigation">
        <Link href={homeHref}>Home</Link>
        <Link href={`${homeHref}/products`}>Shop</Link>
        <Link className="sf-cart-link" href={`${homeHref}/cart`}>
          Cart <span>{cart.totals.itemCount}</span>
        </Link>
      </nav>
    </header>
  );
}
