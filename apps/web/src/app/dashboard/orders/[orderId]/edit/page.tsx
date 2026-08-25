import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { getOrderShipments } from "../../../../../modules/courier/courier.service";
import { OrderEditForm } from "../../../../../modules/orders/components/order-edit-form";
import { updateOrderDetailsFormAction } from "../../../../../modules/orders/order.actions";
import { getOrderEditableDetailsForStore } from "../../../../../modules/orders/order.service";
import { getOrderItemLocksForStore } from "../../../../../modules/orders/order.repository";
import type { OrderFormProductOption } from "../../../../../modules/orders/components/order-create-form";
import { getPaymentMethods } from "../../../../../modules/payments/payment.service";
import { getStoreVariantOptions } from "../../../../../modules/products/product-variants.service";
import { getProductsForStore } from "../../../../../modules/products/product.service";
import { requireStore } from "../../../../../modules/stores/queries";

type EditOrderPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function EditOrderPage({ params }: EditOrderPageProps) {
  const { orderId } = await params;
  const store = await requireStore();
  const order = await getOrderEditableDetailsForStore(store.id, orderId);

  if (!order) notFound();

  const orderNumber = order.orderNumber.startsWith("#")
    ? order.orderNumber
    : `#${order.orderNumber}`;
  const address = order.shippingAddress;
  // A booked shipment carries the address the carrier already printed, so a
  // correction made here has to be phoned through to them as well.
  const booked = (await getOrderShipments(store.id, order.id)).length > 0;
  const [paymentMethods, products, variantsByProductId, returnCount] = await Promise.all([
    getPaymentMethods(store.id),
    getProductsForStore(store.id),
    getStoreVariantOptions(store.id),
    getOrderItemLocksForStore(store.id, order.id)
  ]);

  // Archived products cannot be sold, here or on the create form. Drafts and
  // hidden ones stay: an item pulled from the storefront is still an item the
  // seller can put on an order over the phone.
  const productOptions: OrderFormProductOption[] = products
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

  // Both refusals are somebody else already holding these exact lines. The
  // server enforces them again; this is so the seller is told before typing.
  const itemsLockedReason = booked
    ? "This order is already booked with a courier, so its products cannot be changed — the carrier is holding a label with this amount on it. Cancel the booking first, or change the delivery charge only."
    : returnCount > 0
      ? "This order has a return filed against it, so its products cannot be changed. The return is recorded against the lines as they stand."
      : undefined;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1>Edit order {orderNumber}</h1>
            <p className="auth-copy">
              Change what was ordered, what it costs, and who it is going to. Adding, removing, or
              re-counting a product moves stock to match, so the catalog stays honest.
            </p>
          </div>
          <Link className="secondary link-button" href={`/dashboard/orders/${order.id}`}>
            Back
          </Link>
        </div>
        <div className="panel-card">
          <OrderEditForm
            action={updateOrderDetailsFormAction.bind(null, order.id)}
            cancelHref={`/dashboard/orders/${order.id}`}
            currency={order.currency}
            order={{
              addressLine1: address?.addressLine1 ?? null,
              addressLine2: address?.addressLine2 ?? null,
              area: address?.area ?? order.shippingArea,
              city: address?.city ?? order.shippingCity,
              country: address?.country ?? "Bangladesh",
              customerEmail: order.customerEmail,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              discountAmount: Number(order.discountAmount).toFixed(2),
              district: address?.district ?? order.shippingDistrict,
              notes: order.notes,
              paymentMethod: order.paymentMethodType,
              paymentNote: order.paymentNote,
              paymentReference: order.paymentReference,
              lines: order.items.map((item) => ({
                price: Number(item.price).toFixed(2),
                productId: item.productId ?? "",
                quantity: item.quantity,
                title: item.title,
                variantId: item.variantId
              })),
              postalCode: address?.postalCode ?? null,
              shippingAmount: Number(order.shippingAmount).toFixed(2)
            }}
            paymentMethods={paymentMethods.map((method) => ({
              isEnabled: method.isEnabled,
              name: method.name,
              type: method.type
            }))}
            products={productOptions}
            {...(itemsLockedReason ? { itemsLockedReason } : {})}
            {...(booked
              ? {
                  bookedWarning:
                    "This order is already booked with a courier. Saving updates the order here, but the courier still has the old details — call them to change the delivery."
                }
              : {})}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
