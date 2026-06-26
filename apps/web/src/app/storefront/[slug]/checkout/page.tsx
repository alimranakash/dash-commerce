import Link from "next/link";
import { CartSummary } from "../../../../modules/cart/components/cart-summary";
import { getCart } from "../../../../modules/cart/cart.service";
import { CheckoutForm } from "../../../../modules/checkout/components/checkout-form";
import { getEnabledPaymentMethods } from "../../../../modules/payments/payment.service";
import { getEnabledShippingRates } from "../../../../modules/shipping/shipping.service";
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
  const paymentMethods = await getEnabledPaymentMethods(store.id);
  const shippingRates = await getEnabledShippingRates(store.id);
  const checkoutShippingRates = shippingRates.map((rate) => ({
    id: rate.id,
    name: rate.name,
    district: rate.district,
    city: rate.city,
    area: rate.area,
    amount: rate.amount.toString(),
    zone: {
      name: rate.zone.name
    }
  }));

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <section className="sf-shop-hero" aria-labelledby="checkout-title">
        <p>{primaryDomain?.domain ?? `${store.slug}.dash.com`}</p>
        <h1 id="checkout-title">Checkout</h1>
        <span>Enter delivery details, choose shipping, and select a payment method.</span>
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
          <CheckoutForm
            checkoutError={checkoutError}
            currency={store.currency}
            paymentMethods={paymentMethods}
            shippingRates={checkoutShippingRates}
            storeSlug={store.slug}
          />
          <CartSummary
            cart={cart}
            currency={store.currency}
            {...(checkoutShippingRates[0]
              ? {
                  shippingAmount: checkoutShippingRates[0].amount,
                  shippingLabel: checkoutShippingRates[0].name
                }
              : {})}
            storeId={store.id}
            storeSlug={store.slug}
          />
        </section>
      )}
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
