import { randomUUID } from "node:crypto";
import { storefrontBasePath } from "../../../../modules/storefront/base-path";
import Link from "next/link";
import { getCart } from "../../../../modules/cart/cart.service";
import { isCheckoutPhoneOtpRequired } from "../../../../modules/checkout/checkout-verification.service";
import { CheckoutExperience } from "../../../../modules/checkout/components/checkout-experience";
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
            cart={cart}
            checkoutError={checkoutError}
            currency={store.currency}
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
