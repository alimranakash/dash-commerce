import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { getOrderShipments } from "../../../../../modules/courier/courier.service";
import { OrderEditForm } from "../../../../../modules/orders/components/order-edit-form";
import { updateOrderDetailsFormAction } from "../../../../../modules/orders/order.actions";
import { getOrderEditableDetailsForStore } from "../../../../../modules/orders/order.service";
import { getPaymentMethods } from "../../../../../modules/payments/payment.service";
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
  const paymentMethods = await getPaymentMethods(store.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1>Edit order {orderNumber}</h1>
            <p className="auth-copy">
              Fix the customer name, phone, email, or delivery address the shopper entered wrong,
              and set the delivery charge, discount, and payment details you agreed with them.
              Which products were bought is not changed here — that would move stock.
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
              postalCode: address?.postalCode ?? null,
              shippingAmount: Number(order.shippingAmount).toFixed(2),
              subtotalAmount: String(order.subtotalAmount)
            }}
            paymentMethods={paymentMethods.map((method) => ({
              isEnabled: method.isEnabled,
              name: method.name,
              type: method.type
            }))}
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
