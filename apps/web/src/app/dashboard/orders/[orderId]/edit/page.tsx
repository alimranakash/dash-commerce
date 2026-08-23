import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { getOrderShipments } from "../../../../../modules/courier/courier.service";
import { OrderEditForm } from "../../../../../modules/orders/components/order-edit-form";
import { updateOrderDetailsFormAction } from "../../../../../modules/orders/order.actions";
import { getOrderEditableDetailsForStore } from "../../../../../modules/orders/order.service";
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

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1>Edit order {orderNumber}</h1>
            <p className="auth-copy">
              Fix the customer name, phone, email, or delivery address the shopper entered wrong.
              Products and totals are not changed.
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
            order={{
              addressLine1: address?.addressLine1 ?? null,
              addressLine2: address?.addressLine2 ?? null,
              area: address?.area ?? order.shippingArea,
              city: address?.city ?? order.shippingCity,
              country: address?.country ?? "Bangladesh",
              customerEmail: order.customerEmail,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              district: address?.district ?? order.shippingDistrict,
              notes: order.notes,
              postalCode: address?.postalCode ?? null
            }}
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
