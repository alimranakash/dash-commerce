import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { isStoreOrderConfirmSmsEnabled } from "../../../../modules/notifications/store-messaging.service";
import {
  OrderCreateForm,
  type OrderFormProductOption
} from "../../../../modules/orders/components/order-create-form";
import { createOrderFormAction } from "../../../../modules/orders/order.actions";
import { getPaymentMethods } from "../../../../modules/payments/payment.service";
import { getStoreVariantOptions } from "../../../../modules/products/product-variants.service";
import { getProductsForStore } from "../../../../modules/products/product.service";
import { getEnabledShippingRates } from "../../../../modules/shipping/shipping.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function NewOrderPage() {
  const store = await requireStore();
  const [products, variantsByProductId, shippingRates, paymentMethods, smsEnabled] =
    await Promise.all([
      getProductsForStore(store.id),
      getStoreVariantOptions(store.id),
      getEnabledShippingRates(store.id),
      getPaymentMethods(store.id),
      isStoreOrderConfirmSmsEnabled(store.id)
    ]);

  // Archived products are the one thing the seller cannot sell here. Drafts and
  // hidden products stay — an item pulled from the storefront is still an item
  // the seller can sell over the phone, and the service accepts them for exactly
  // that reason.
  const options: OrderFormProductOption[] = products
    .filter((product) => product.status !== "ARCHIVED")
    .map((product) => ({
      id: product.id,
      imageUrl: product.images[0]?.url ?? null,
      price: String(product.price),
      sku: product.sku,
      status: product.status,
      stockQuantity: product.stockQuantity,
      title: product.title,
      variants: (variantsByProductId.get(product.id) ?? []).map((variant) => ({
        id: variant.id,
        price: variant.price,
        sku: variant.sku,
        stockQuantity: variant.stockQuantity,
        title: variant.title
      }))
    }));

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1>Create order</h1>
            <p className="auth-copy">
              Take an order that came in over the phone, on Messenger, or at the counter. It is
              saved exactly like a storefront order, so stock, courier booking, and SMS all work on
              it.
            </p>
          </div>
          <Link className="secondary link-button" href="/dashboard/orders">
            Back
          </Link>
        </div>
        <div className="panel-card">
          <OrderCreateForm
            action={createOrderFormAction}
            cancelHref="/dashboard/orders"
            currency={store.currency}
            paymentMethods={paymentMethods.map((method) => ({
              isEnabled: method.isEnabled,
              name: method.name,
              type: method.type
            }))}
            products={options}
            shippingRates={shippingRates.map((rate) => ({
              amount: String(rate.amount),
              id: rate.id,
              name: rate.name
            }))}
            smsEnabled={smsEnabled}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
