import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicOrderByNumber } from "../../../../../modules/orders/order.service";
import {
  getPaymentMethods,
  isManualPaymentType
} from "../../../../../modules/payments/payment.service";
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
  const paymentMethod = order
    ? (await getPaymentMethods(store.id)).find((method) => method.type === order.paymentMethodType)
    : null;

  if (!order) {
    notFound();
  }

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <section className="sf-thank-you" aria-labelledby="thank-you-title">
        <p>Order received</p>
        <h1 id="thank-you-title">Thank you, {order.customerName}.</h1>
        <span>Your order has been placed successfully. Payment confirmation is pending.</span>
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
            <span>Shipping</span>
            <strong>{formatMoney(order.shippingAmount, order.currency)}</strong>
          </div>
          <div>
            <span>Delivery method</span>
            <strong>{order.shippingRateName ?? "Manual delivery"}</strong>
          </div>
          <div>
            <span>Payment status</span>
            <strong>{order.paymentStatus.toLowerCase()}</strong>
          </div>
          <div>
            <span>Payment method</span>
            <strong>{order.paymentMethodName}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{order.status.toLowerCase()}</strong>
          </div>
        </div>
        {isManualPaymentType(order.paymentMethodType) || paymentMethod?.instructions ? (
          <div className="sf-payment-instructions">
            <h2>Payment instructions</h2>
            {paymentMethod?.accountNumber ? (
              <p>
                Send payment to {paymentMethod.name}: <strong>{paymentMethod.accountNumber}</strong>
              </p>
            ) : null}
            {paymentMethod?.instructions ? <p>{paymentMethod.instructions}</p> : null}
            {order.paymentReference ? (
              <p>
                Reference submitted: <strong>{order.paymentReference}</strong>
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="sf-thank-you-items">
          <h2>Order summary</h2>
          {order.items.map((item) => (
            <div key={item.id}>
              <span>
                {item.title} x {item.quantity}
              </span>
              <strong>{formatMoney(item.total, order.currency)}</strong>
            </div>
          ))}
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
