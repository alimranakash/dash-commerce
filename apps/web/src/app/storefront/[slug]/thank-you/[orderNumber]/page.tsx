import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicOrderByNumber } from "../../../../../modules/orders/order.service";
import { StorefrontFooter } from "../../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../../modules/storefront/components/storefront-header";
import { requireStorefrontBySlug } from "../../../../../modules/storefront/resolver";

type ThankYouPageProps = {
  params: Promise<{
    orderNumber: string;
    slug: string;
  }>;
};

export default async function ThankYouPage({ params }: ThankYouPageProps) {
  const { orderNumber, slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const order = await getPublicOrderByNumber(store.id, orderNumber);

  if (!order) {
    notFound();
  }

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <section className="sf-thank-you" aria-labelledby="thank-you-title">
        <p>Order received</p>
        <h1 id="thank-you-title">Thank you, {order.customerName}.</h1>
        <span>Your cash on delivery order has been placed successfully.</span>
        <div className="sf-order-confirmation">
          <div>
            <span>Order number</span>
            <strong>{order.orderNumber}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{formatMoney(order.totalAmount, order.currency)}</strong>
          </div>
          <div>
            <span>Payment</span>
            <strong>{order.paymentStatus.toLowerCase()}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{order.status.toLowerCase()}</strong>
          </div>
        </div>
        <Link className="sf-button" href={`/s/${store.slug}/products`}>
          Continue shopping
        </Link>
      </section>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
