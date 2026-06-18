import Link from "next/link";
import { CartSummary } from "../../../../modules/cart/components/cart-summary";
import { getCart } from "../../../../modules/cart/cart.service";
import { CheckoutForm } from "../../../../modules/checkout/components/checkout-form";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import { requireStorefrontBySlug } from "../../../../modules/storefront/resolver";

type CheckoutPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    checkoutError?: string;
  }>;
};

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { slug } = await params;
  const { checkoutError } = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const cart = await getCart(store.id);

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <section className="sf-shop-hero" aria-labelledby="checkout-title">
        <p>{primaryDomain?.domain ?? `${store.slug}.dash.com`}</p>
        <h1 id="checkout-title">Checkout</h1>
        <span>Cash on delivery is available for this first checkout foundation.</span>
      </section>
      {cart.items.length === 0 ? (
        <section className="sf-section">
          <div className="sf-empty">
            <h2>Your cart is empty</h2>
            <p>Add products before placing an order.</p>
            <Link className="sf-button" href={`/s/${store.slug}/products`}>
              Continue shopping
            </Link>
          </div>
        </section>
      ) : (
        <section className="sf-checkout-layout" aria-label="Checkout form">
          <CheckoutForm checkoutError={checkoutError} storeSlug={store.slug} />
          <CartSummary
            cart={cart}
            currency={store.currency}
            storeId={store.id}
            storeSlug={store.slug}
          />
        </section>
      )}
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
