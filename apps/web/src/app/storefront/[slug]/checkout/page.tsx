import { NotificationBarSlot } from "../../../../modules/notification-bar/components/notification-bar-slot";
import { resolveShippingCharge } from "../../../../modules/free-shipping/free-shipping.render";
import {
  cartEarnsFreeShipping,
  getFreeShippingRule
} from "../../../../modules/free-shipping/free-shipping.service";
import { randomUUID } from "node:crypto";
import { storefrontBasePath } from "../../../../modules/storefront/base-path";
import Link from "next/link";
import { getCart } from "../../../../modules/cart/cart.service";
import { isCheckoutPhoneOtpRequired } from "../../../../modules/checkout/checkout-verification.service";
import { CheckoutExperience } from "../../../../modules/checkout/components/checkout-experience";
import { priceCartBundles } from "../../../../modules/merchandising/bundle.service";
import { resolveOrderBumpOffer } from "../../../../modules/merchandising/order-bump.service";
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
  const basePath = await storefrontBasePath(store.slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const cart = await getCart(store.id);
  const paymentMethods = await getEnabledPaymentMethods(store.id);
  const shippingRates = await getEnabledShippingRates(store.id);
  const phoneOtpRequired = await isCheckoutPhoneOtpRequired(store.id);
  // Priced here and priced again when the order is placed, both times from the
  // product's live price. Only the id ever travels with the form.
  // Priced from the cart alone, exactly as the order will price it, so the
  // saving on screen is the saving charged.
  const bundles = await priceCartBundles(
    store.id,
    cart.items.map((item) => ({
      lineId: item.lineId,
      price: item.price,
      productId: item.productId,
      quantity: item.quantity
    }))
  );
  const orderBump = await resolveOrderBumpOffer({
    cartProductIds: cart.items.map((item) => item.productId),
    storeId: store.id
  });
  // Quoted through the same function that will charge it, so the figure beside
  // each delivery option is the figure the order is created with. A shop with no
  // threshold configured gets its rates back untouched.
  const freeShippingRule = await getFreeShippingRule(store.id);
  const cartHasFreeShippingProduct = await cartEarnsFreeShipping(
    store.id,
    cart.items.map((item) => item.productId)
  );
  const checkoutShippingRates = shippingRates.map((rate) => ({
    id: rate.id,
    name: rate.name,
    district: rate.district,
    city: rate.city,
    area: rate.area,
    amount: resolveShippingCharge(freeShippingRule, {
      hasFreeShippingProduct: cartHasFreeShippingProduct,
      rateAmount: rate.amount.toString(),
      subtotal: cart.totals.subtotal,
      zoneId: rate.zoneId
    }),
    zone: {
      name: rate.zone.name
    }
  }));

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <NotificationBarSlot anchor="top" store={store} surface="other" />
      {cart.items.length === 0 ? (
        <section className="sf-section">
          <div className="sf-empty">
            <h2>Your cart is empty</h2>
            <p>Add products before placing an order.</p>
            <Link className="sf-button" href={`${basePath}/products`}>
              Continue shopping
            </Link>
          </div>
        </section>
      ) : (
        <CheckoutExperience
          bundles={bundles.applied}
          cart={cart}
          checkoutError={checkoutError}
          currency={store.currency}
          orderBump={orderBump}
          paymentMethods={paymentMethods}
          phoneOtpRequired={phoneOtpRequired}
          shippingRates={checkoutShippingRates}
          storeSlug={store.slug}
          submissionId={randomUUID()}
        />
      )}
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
