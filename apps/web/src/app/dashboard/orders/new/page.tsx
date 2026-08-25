import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { getIncompleteOrderDraft } from "../../../../modules/abandoned-carts/abandoned-cart.service";
import { isStoreOrderConfirmSmsEnabled } from "../../../../modules/notifications/store-messaging.service";
import {
  OrderCreateForm,
  type OrderCreatePrefill,
  type OrderFormProductOption
} from "../../../../modules/orders/components/order-create-form";
import { createOrderFormAction } from "../../../../modules/orders/order.actions";
import { getPaymentMethods } from "../../../../modules/payments/payment.service";
import { getStoreVariantOptions } from "../../../../modules/products/product-variants.service";
import { getProductsForStore } from "../../../../modules/products/product.service";
import { getEnabledShippingRates } from "../../../../modules/shipping/shipping.service";
import { requireStore } from "../../../../modules/stores/queries";

type NewOrderPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  // Set when the seller followed "Create Order" out of the incomplete list.
  const fromIncomplete = singleValue(params.fromIncomplete).trim();
  const [products, variantsByProductId, shippingRates, paymentMethods, smsEnabled, draft] =
    await Promise.all([
      getProductsForStore(store.id),
      getStoreVariantOptions(store.id),
      getEnabledShippingRates(store.id),
      getPaymentMethods(store.id),
      isStoreOrderConfirmSmsEnabled(store.id),
      fromIncomplete ? getIncompleteOrderDraft(store.id, fromIncomplete) : null
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

  const prefill: OrderCreatePrefill | undefined = draft
    ? {
        addressLine1: draft.addressLine1,
        addressLine2: draft.addressLine2,
        area: draft.area,
        city: draft.city,
        country: draft.country,
        couponCode: draft.couponCode,
        customerEmail: draft.customerEmail,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        district: draft.district,
        lines: draft.lines.map((line) => ({
          price: line.price,
          productId: line.productId,
          quantity: line.quantity,
          title: line.title,
          variantId: line.variantId
        })),
        notes: draft.notes,
        paymentMethod: draft.paymentMethod,
        postalCode: draft.postalCode,
        shippingRateId: draft.shippingRateId,
        sourceId: draft.id
      }
    : undefined;
  // Back where they came from, so converting one lead and returning for the
  // next is a two-click loop rather than a hunt through the sidebar.
  const backHref = fromIncomplete ? "/dashboard/orders/incomplete" : "/dashboard/orders";

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
            {/*
              Only when the link pointed at something that has since gone: the
              snapshot may have been converted, cleared or recovered between the
              list being drawn and this page opening.
            */}
            {fromIncomplete && !draft ? (
              <p className="m-0 mt-2 text-sm font-medium text-[#a3203a]">
                That incomplete order is no longer available, so nothing was prefilled.
              </p>
            ) : null}
          </div>
          <Link className="secondary link-button" href={backHref}>
            Back
          </Link>
        </div>
        <div className="panel-card">
          <OrderCreateForm
            action={createOrderFormAction}
            cancelHref={backHref}
            currency={store.currency}
            paymentMethods={paymentMethods.map((method) => ({
              isEnabled: method.isEnabled,
              name: method.name,
              type: method.type
            }))}
            prefill={prefill}
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

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
