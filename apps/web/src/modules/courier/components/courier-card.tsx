import { Truck } from "lucide-react";
import type { ReactNode } from "react";
import { OrderStatusBadge } from "../../orders/components/order-status-badge";
import { RefreshStatusButton } from "./refresh-status-button";
import { SendToCourierButton } from "./send-to-courier-button";

/**
 * The order-detail courier surface, replacing the hardcoded "Not booked" /
 * "Not assigned" rows. Renders one of two states: a send prompt, or the live
 * booking with its delivery history.
 */

export type CourierCardShipment = {
  bookedAt: Date | null;
  codAmount: string;
  createdAt: Date;
  events: Array<{
    id: string;
    message: string | null;
    occurredAt: Date;
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
  courierLabel,
  orderId,
  sendDisabledReason,
  shipment,
  shippingCost,
  shippingMethod
}: {
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
          <h2 className="m-0 text-sm font-semibold text-[#20212a]">Courier</h2>
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

          {shipment.events.length > 0 ? (
            <div className="border-t border-[#f0eff7] pt-4">
              <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-[#777985]">
                Delivery history
              </h3>
              <ul className="mt-3 grid gap-2.5">
                {shipment.events.map((event) => (
                  <li className="grid gap-0.5 text-[11px] leading-5" key={event.id}>
                    <span className="font-medium text-[#292a34]">
                      {event.message ?? event.status}
                    </span>
                    <span className="text-[#858691]">
                      {formatDate(event.occurredAt)} · {sourceLabel(event.source)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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

function sourceLabel(source: string) {
  switch (source) {
    case "MANUAL":
      return "by seller";
    case "PROVIDER_POLL":
      return "from courier";
    case "PROVIDER_WEBHOOK":
      return "courier update";
    default:
      return "system";
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
