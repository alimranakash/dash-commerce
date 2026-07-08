import { CalendarDays, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CustomerCard, OrderItemsTable, OrderStatusCards, OrderSummaryCard, OrderTimeline, PaymentCard, QuickActionsCard, ShippingCard, type OrderAddressView } from "../../../../modules/orders/components/order-detail-components";
import { OrderHeaderActions } from "../../../../modules/orders/components/order-detail-actions";
import { getOrderByIdForStore } from "../../../../modules/orders/order.service";
import { requireStore } from "../../../../modules/stores/queries";

type OrderDetailsPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const { orderId } = await params;
  const store = await requireStore();
  const order = await getOrderByIdForStore(store.id, orderId);

  if (!order) notFound();

  const orderNumber = order.orderNumber.startsWith("#") ? order.orderNumber : `#${order.orderNumber}`;
  const paymentDate = order.paymentStatus === "PENDING" ? "Awaiting payment" : formatDate(order.updatedAt);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)]">
        <header className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="m-0 text-[11px] font-semibold uppercase text-[#7c3aed]">Order Details</p>
              <h1 className="mt-1.5 text-[1.75rem] font-semibold leading-tight text-[#20212a]">{orderNumber}</h1>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#777985]">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(order.createdAt)}</span>
                <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{order.customerName}</span>
              </div>
            </div>
            <OrderHeaderActions />
          </div>
        </header>

        <OrderStatusCards fulfillmentStatus={order.fulfillmentStatus} orderStatus={order.status} paymentStatus={order.paymentStatus} />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <CustomerCard
            billingAddress={addressView(order.billingAddress)}
            email={order.customerEmail}
            name={order.customerName}
            phone={order.customerPhone}
            shippingAddress={addressView(order.shippingAddress)}
          />
          <OrderSummaryCard
            discount={formatMoney(order.discountAmount, order.currency)}
            shipping={formatMoney(order.shippingAmount, order.currency)}
            subtotal={formatMoney(order.subtotalAmount, order.currency)}
            tax={formatMoney(order.taxAmount, order.currency)}
            total={formatMoney(order.totalAmount, order.currency)}
          />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <PaymentCard method={order.paymentMethodName} paymentDate={paymentDate} reference={order.paymentReference} status={order.paymentStatus} />
          <ShippingCard cost={formatMoney(order.shippingAmount, order.currency)} deliveryStatus={order.fulfillmentStatus} method={order.shippingRateName ?? "Manual delivery"} />
        </div>

        <OrderItemsTable
          currency={order.currency}
          items={order.items.map((item) => ({
            id: item.id,
            imageUrl: item.imageUrl,
            price: Number(item.price),
            quantity: item.quantity,
            sku: item.sku,
            title: item.title,
            total: Number(item.total)
          }))}
        />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
          <OrderTimeline createdAt={order.createdAt} fulfillmentStatus={order.fulfillmentStatus} orderStatus={order.status} paymentStatus={order.paymentStatus} updatedAt={order.updatedAt} />
          <QuickActionsCard orderId={order.id} />
        </div>
      </section>
    </DashboardShell>
  );
}

function addressView(address: {
  addressLine1: string;
  addressLine2: string | null;
  area: string | null;
  city: string | null;
  country: string;
  district: string;
} | null): OrderAddressView | null {
  return address ? {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    area: address.area,
    city: address.city,
    country: address.country,
    district: address.district
  } : null;
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
