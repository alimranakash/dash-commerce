import { Truck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { OrderStatusBadge } from "../../orders/components/order-status-badge";
import { DeliveryTimeline } from "./order-tracking-panel";
import { RefreshStatusButton } from "./refresh-status-button";
import { SendToCourierButton } from "./send-to-courier-button";
import type { CourierAutoSyncView } from "../courier.service";

/**
 * The order-detail courier surface: booking and tracking in one panel, because
 * from the seller's side they are one question — "where is this parcel?" —
 * whose first answer is sometimes "not sent yet".
 *
 * Renders one of two states: a send prompt, or the live booking with its
 * delivery history. The history is the same `DeliveryTimeline` the Order
 * Tracking page uses, so the two surfaces cannot drift.
 */

export type CourierCardShipment = {
  bookedAt: Date | null;
  codAmount: string;
  createdAt: Date;
  events: Array<{
    id: string;
    message: string | null;
    occurredAt: Date;
    providerStatus: string | null;
    source: string;
    status: string;
  }>;
  id: string;
  lastError: string | null;
  lastSyncedAt: Date | null;
  providerLabel: string;
  providerShipmentId: string | null;
  /** The carrier's own string, shown verbatim. */
  providerStatus: string | null;
  status: string;
  trackingCode: string | null;
};

export function CourierCard({
  autoSync,
  courierLabel,
  orderId,
  sendDisabledReason,
  shipment,
  shippingCost,
  shippingMethod
}: {
  /** Whether this store's carrier pushes delivery updates here on its own. */
  autoSync: CourierAutoSyncView;
  courierLabel: string;
  orderId: string;
  sendDisabledReason?: string | undefined;
  shipment: CourierCardShipment | null;
  shippingCost: string;
  shippingMethod: string;
}) {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="mb-4 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-[#7548f5]" />
          <span className="grid">
            <h2 className="m-0 text-sm font-semibold text-[#20212a]">Order Tracking</h2>
            <span className="text-[10px] text-[#858691]">
              {shipment ? shipment.providerLabel : "Not booked yet"}
            </span>
          </span>
        </span>
        {shipment ? <RefreshStatusButton orderId={orderId} shipmentId={shipment.id} /> : null}
      </header>

      {shipment ? (
        <div className="grid gap-4">
          <Rows
            rows={[
              ["Courier", shipment.providerLabel],
              ["Consignment", mono(shipment.providerShipmentId)],
              ["Tracking Code", mono(shipment.trackingCode)],
              [
                "Delivery Status",
                <CarrierStatusBadge
                  internalStatus={shipment.status}
                  key="status"
                  providerStatus={shipment.providerStatus}
                />
              ],
              [
                "Last checked",
                shipment.lastSyncedAt ? formatDate(shipment.lastSyncedAt) : "Not checked yet"
              ],
              [
                "Full history",
                <Link
                  className="font-semibold text-[#6d3cf5] hover:underline"
                  href="/dashboard/orders/tracking"
                  key="tracking"
                >
                  Open in Order Tracking
                </Link>
              ],
              ["COD Amount", shipment.codAmount],
              ["Shipping Method", shippingMethod],
              ["Shipping Cost", shippingCost],
              ["Booked", shipment.bookedAt ? formatDate(shipment.bookedAt) : "Awaiting confirmation"]
            ]}
          />

          {shipment.lastError ? (
            <p className="m-0 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700">
              {shipment.lastError}
            </p>
          ) : null}

          <AutoSyncRow autoSync={autoSync} />

          <DeliveryTimeline events={shipment.events} />
        </div>
      ) : (
        <div className="grid gap-4">
          <Rows
            rows={[
              ["Courier", "Not booked"],
              ["Shipping Method", shippingMethod],
              ["Tracking Code", "Not assigned"],
              ["Shipping Cost", shippingCost]
            ]}
          />
          <SendToCourierButton
            courierLabel={courierLabel}
            orderId={orderId}
            {...(sendDisabledReason ? { disabledReason: sendDisabledReason } : {})}
          />
        </div>
      )}
    </section>
  );
}

/**
 * Says whether this status keeps itself current.
 *
 * Without it a timestamp is ambiguous: a seller cannot tell a parcel that has
 * genuinely not moved from an integration that stopped reporting. Auto-sync off
 * links straight to where it is turned on, rather than describing it.
 */
function AutoSyncRow({ autoSync }: { autoSync: CourierAutoSyncView }) {
  if (!autoSync.enabled) {
    return (
      <p className="m-0 rounded-lg bg-[#faf9ff] px-3 py-2 text-[11px] leading-5 text-[#6b6c7c]">
        Auto-sync is off — this status only changes when you press Refresh.{" "}
        <Link className="font-semibold text-[#6d3cf5] hover:underline" href="/dashboard/settings/courier">
          Set up the courier webhook
        </Link>
        .
      </p>
    );
  }

  return (
    <p className="m-0 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] leading-5 text-emerald-700">
      Auto-syncing from the courier
      {autoSync.lastSeenAt ? ` · last update received ${formatDate(autoSync.lastSeenAt)}` : ""}
    </p>
  );
}

/**
 * Prints the carrier's `delivery_status` exactly as it was returned — no title
 * casing, no underscore stripping, no filtering — because a seller chasing a
 * parcel with Steadfast support needs the same token Steadfast uses.
 *
 * Colour comes from our internal mapping rather than the raw string, which is
 * what keeps `delivered_approval_pending` amber instead of reading as a
 * completed delivery.
 */
function CarrierStatusBadge({
  internalStatus,
  providerStatus
}: {
  internalStatus: string;
  providerStatus: string | null;
}) {
  if (!providerStatus) {
    return <OrderStatusBadge status={internalStatus} />;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${statusTone(internalStatus)}`}
      title={`Mapped internally to ${internalStatus}`}
    >
      {providerStatus}
    </span>
  );
}

function statusTone(internalStatus: string) {
  if (internalStatus === "DELIVERED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["BOOKED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "PARTIALLY_DELIVERED", "PICKED_UP"].includes(internalStatus)) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (["CANCELLED", "FAILED", "LOST", "RETURNED"].includes(internalStatus)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function Rows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,0.7fr)_minmax(0,1fr)] gap-x-5 gap-y-4 text-xs">
      {rows.map(([label, value]) => (
        <div className="contents" key={label}>
          <dt className="text-[#777985]">{label}</dt>
          <dd className="m-0 font-medium text-[#292a34]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function mono(value: string | null) {
  return value ? <span className="font-mono text-[11px]">{value}</span> : "Not assigned";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
