import Link from "next/link";
import { CartLineItem } from "../../../../modules/cart/components/cart-line-item";
import { CartSummary } from "../../../../modules/cart/components/cart-summary";
import { getCart } from "../../../../modules/cart/cart.service";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import { requireStorefrontBySlug } from "../../../../modules/storefront/resolver";

type StorefrontCartPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    added?: string;
    cartError?: string;
    cleared?: string;
    removed?: string;
    updated?: string;
  }>;
};

export default async function StorefrontCartPage({
  params,
  searchParams
}: StorefrontCartPageProps) {
  const { slug } = await params;
  const feedback = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const cart = await getCart(store.id);

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <section className="sf-shop-hero" aria-labelledby="cart-title">
        <p>{primaryDomain?.domain ?? `${store.slug}.dash.com`}</p>
        <h1 id="cart-title">Your cart</h1>
        <span>Review selected products before checkout.</span>
      </section>
      <section className="sf-cart-layout" aria-label="Shopping cart">
        <div className="sf-cart-items">
          {feedback.cartError ? <p className="sf-alert">{feedback.cartError}</p> : null}
          {feedback.added ? <p className="sf-success">Product added to cart.</p> : null}
          {feedback.updated ? <p className="sf-success">Cart quantity updated.</p> : null}
          {feedback.removed ? <p className="sf-success">Product removed from cart.</p> : null}
          {feedback.cleared ? <p className="sf-success">Cart cleared.</p> : null}
          {cart.items.length === 0 ? (
            <div className="sf-empty">
              <h2>Your cart is empty</h2>
              <p>Published products from this store will appear here after you add them.</p>
              <Link className="sf-button" href={`/s/${store.slug}/products`}>
                Continue shopping
              </Link>
            </div>
          ) : (
            cart.items.map((item) => (
              <CartLineItem
                currency={store.currency}
                item={item}
                key={item.productId}
                storeId={store.id}
                storeSlug={store.slug}
              />
            ))
          )}
        </div>
        <CartSummary
          cart={cart}
          currency={store.currency}
          storeId={store.id}
          storeSlug={store.slug}
        />
      </section>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
