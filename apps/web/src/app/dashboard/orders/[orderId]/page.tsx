import { CalendarDays, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CustomerCard, OrderItemsTable, OrderStatusCards, OrderSummaryCard, OrderTimeline, PaymentCard, QuickActionsCard, type OrderAddressView } from "../../../../modules/orders/components/order-detail-components";
import { OrderHeaderActions } from "../../../../modules/orders/components/order-detail-actions";
import { CourierCard } from "../../../../modules/courier/components/courier-card";
import { CourierScoreCard } from "../../../../modules/courier/components/courier-score-card";
import { describeSendTarget } from "../../../../modules/courier/courier-accounts.service";
import { getCachedCourierScore } from "../../../../modules/courier/courier-insight.service";
import {
  getCourierAutoSync,
  getOrderShipments,
  getShipmentTimeline
} from "../../../../modules/courier/courier.service";
import { getCourierProvider } from "../../../../modules/courier/providers/registry";
import { getOrderByIdForStore } from "../../../../modules/orders/order.service";
import { OrderReturnsPanel } from "../../../../modules/returns/components/order-returns-panel";
import { hasPlanFeature } from "../../../../modules/billing/subscription-limits";
import { requireStore } from "../../../../modules/stores/queries";

type OrderDetailsPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrderDetailsPage({ params, searchParams }: OrderDetailsPageProps) {
  const { orderId } = await params;
  const store = await requireStore();
  const order = await getOrderByIdForStore(store.id, orderId);
  const flags = await searchParams;
  const updated = Boolean(flags.updated);
  const created = Boolean(flags.created);

  if (!order) notFound();

  const orderNumber = order.orderNumber.startsWith("#") ? order.orderNumber : `#${order.orderNumber}`;
  const paymentDate = order.paymentStatus === "PENDING" ? "Awaiting payment" : formatDate(order.updatedAt);
  const shipment = (await getOrderShipments(store.id, order.id))[0] ?? null;
  const shipmentEvents = shipment ? await getShipmentTimeline(store.id, shipment.id) : [];
  // Whether the carrier pushes updates here on its own, so the tracking panel can
  // say why a status might be stale instead of leaving the seller to guess.
  const autoSync = shipment
    ? await getCourierAutoSync(store.id, shipment.provider)
    : { enabled: false, lastSeenAt: null };
  const sendTarget = await describeSendTarget(store.id);
  // Cache-only on render: checking the carrier is an explicit click.
  const courierScore = await getCachedCourierScore(store.id, order.customerPhone);

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
            <OrderHeaderActions orderId={order.id} />
          </div>
        </header>

        {created ? <p className="success-message">Order created.</p> : null}
        {updated ? <p className="success-message">Order updated.</p> : null}

        <OrderStatusCards fulfillmentStatus={order.fulfillmentStatus} orderStatus={order.status} paymentStatus={order.paymentStatus} />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <CustomerCard
            billingAddress={addressView(order.billingAddress)}
            email={order.customerEmail}
            name={order.customerName}
            phone={order.customerPhone}
            shippingAddress={addressView(order.shippingAddress)}
          />
          <div className="grid items-start gap-4">
            <OrderSummaryCard
              discount={formatMoney(order.discountAmount, order.currency)}
              shipping={formatMoney(order.shippingAmount, order.currency)}
              subtotal={formatMoney(order.subtotalAmount, order.currency)}
              tax={formatMoney(order.taxAmount, order.currency)}
              total={formatMoney(order.totalAmount, order.currency)}
            />
            <CourierScoreCard
              cached={courierScore}
              locked={!(await hasPlanFeature(store.id, "fraud_check"))}
              phone={order.customerPhone}
            />
          </div>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <PaymentCard method={order.paymentMethodName} paymentDate={paymentDate} reference={order.paymentReference} status={order.paymentStatus} />
          <CourierCard
            autoSync={autoSync}
            courierLabel={sendTarget.label}
            orderId={order.id}
            shipment={shipment ? {
              bookedAt: shipment.bookedAt,
              codAmount: formatMoney(shipment.codAmount, order.currency),
              createdAt: shipment.createdAt,
              events: shipmentEvents.map((event) => ({
                id: event.id,
                message: event.message,
                occurredAt: event.occurredAt,
                providerStatus: event.providerStatus,
                source: event.source,
                status: event.status
              })),
              id: shipment.id,
              lastError: shipment.lastError,
              lastSyncedAt: shipment.lastSyncedAt,
              providerLabel: getCourierProvider(shipment.provider)?.label ?? shipment.provider,
              providerShipmentId: shipment.providerShipmentId,
              providerStatus: shipment.providerStatus,
              status: shipment.status,
              trackingCode: shipment.trackingCode
            } : null}
            shippingCost={formatMoney(order.shippingAmount, order.currency)}
            shippingMethod={order.shippingRateName ?? "Manual delivery"}
            {...(sendTarget.reason ? { sendDisabledReason: sendTarget.reason } : {})}
          />
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

        <OrderReturnsPanel currency={order.currency} orderId={order.id} storeId={store.id} />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
          <OrderTimeline createdAt={order.createdAt} fulfillmentStatus={order.fulfillmentStatus} orderStatus={order.status} paymentStatus={order.paymentStatus} updatedAt={order.updatedAt} />
          <QuickActionsCard
            courierLabel={sendTarget.label}
            hasShipment={shipment !== null}
            orderId={order.id}
            {...(sendTarget.reason ? { sendDisabledReason: sendTarget.reason } : {})}
          />
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
