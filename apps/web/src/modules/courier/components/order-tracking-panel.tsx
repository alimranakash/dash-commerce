"use client";

import { Loader2, PackageSearch, RefreshCcw, Search, Truck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { PaidBadge } from "../../billing/components/paid-badge";
import { PlanUpgradeDialog } from "../../billing/components/plan-upgrade-dialog";
import {
  refreshShipmentStatusAction,
  trackOrderAction,
  type TrackOrderActionState
} from "../courier.actions";
import type { RecentTrackedShipment, TrackedShipmentView } from "../courier.service";

/**
 * Order Tracking: one box, one parcel, its whole delivery history.
 *
 * The search deliberately takes any identifier — tracking code, consignment id,
 * invoice reference or order number — because the seller using this page is
 * usually reading a number off a sticker or repeating one a customer just said,
 * and does not know or care which kind it is.
 *
 * Two different freshness stories are shown side by side, because conflating
 * them is what makes a stale status confusing: `autoSync` says whether the
 * carrier pushes updates here at all, and `lastSyncedAt` says when this parcel
 * was last touched. Auto-sync off plus an old timestamp is a setup problem;
 * auto-sync on plus an old timestamp just means the parcel has not moved.
 */

export function OrderTrackingPanel({
  locked,
  recent
}: {
  locked: boolean;
  recent: RecentTrackedShipment[];
}) {
  const [reference, setReference] = useState("");
  const [state, setState] = useState<TrackOrderActionState | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isPending, startTransition] = useTransition();

  function track(value: string) {
    // Locked is resolved on the server before render, so there is no reason to
    // make the seller wait for a round trip that can only refuse them.
    if (locked) {
      setShowUpgrade(true);
      return;
    }

    setReference(value);

    startTransition(async () => {
      const result = await trackOrderAction(value);

      if (result.lockedFeature) {
        setShowUpgrade(true);
        return;
      }

      setState(result);
    });
  }

  const shipment = state?.shipment ?? null;

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <header className="mb-4 flex flex-wrap items-center gap-2">
          <PackageSearch className="h-4 w-4 text-[#7548f5]" />
          <h2 className="m-0 text-sm font-semibold text-[#20212a]">Track a parcel</h2>
          {locked ? <PaidBadge feature="order_tracking" interactive={false} showPlan /> : null}
        </header>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            track(reference);
          }}
        >
          <input
            aria-label="Tracking code, consignment id, or order number"
            className="h-11 min-w-0 flex-1 rounded-lg border border-[#e4e3ee] px-3 text-sm text-[#30313d] outline-none transition placeholder:text-[#9898aa] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
            name="reference"
            onChange={(event) => setReference(event.target.value)}
            placeholder="Tracking code, consignment id, or order number"
            value={reference}
          />
          <button
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#7548f5] px-5 text-sm font-semibold text-white transition hover:bg-[#6438e8] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isPending ? "Searching…" : "Track"}
          </button>
        </form>

        {state?.message && !state.lockedFeature ? (
          <p className={`m-0 mt-3 rounded-lg px-3 py-2 text-xs leading-5 ${toneClass(state.status)}`}>
            {state.message}
          </p>
        ) : null}
      </section>

      {shipment ? <TrackingResult shipment={shipment} /> : null}

      {recent.length > 0 ? (
        <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <h2 className="m-0 text-sm font-semibold text-[#20212a]">Recent parcels</h2>
          <p className="mt-1 mb-4 text-xs text-[#858691]">
            The last {recent.length} parcel{recent.length === 1 ? "" : "s"} booked from this store.
          </p>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {recent.map((entry) => (
              <li key={entry.id}>
                <button
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-transparent px-3 py-2.5 text-left text-xs transition hover:border-[#e4e0f5] hover:bg-[#faf9ff]"
                  onClick={() => track(entry.trackingCode ?? entry.orderNumber ?? "")}
                  type="button"
                >
                  <span className="font-mono text-[11px] font-semibold text-[#30313d]">
                    {entry.trackingCode ?? "No tracking code"}
                  </span>
                  <span className="text-[#777985]">
                    {entry.orderNumber ? `#${entry.orderNumber.replace(/^#/, "")}` : "—"}
                    {entry.customerName ? ` · ${entry.customerName}` : ""}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <StatusPill internalStatus={entry.status} providerStatus={entry.providerStatus} />
                    <span className="text-[10px] text-[#9a9bab]">{formatDate(entry.updatedAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PlanUpgradeDialog
        feature={showUpgrade ? "order_tracking" : null}
        onClose={() => setShowUpgrade(false)}
      />
    </div>
  );
}

function TrackingResult({ shipment }: { shipment: TrackedShipmentView }) {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-[#7548f5]" />
          <span className="grid">
            <h2 className="m-0 text-sm font-semibold text-[#20212a]">
              {shipment.order ? `Order #${shipment.order.orderNumber.replace(/^#/, "")}` : "Parcel"}
            </h2>
            <span className="text-[10px] text-[#858691]">{shipment.providerLabel}</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {shipment.order ? (
            <Link
              className="inline-flex h-8 items-center rounded-lg border border-[#dcd9e8] bg-white px-3 text-[11px] font-semibold text-[#5f616d] transition hover:border-[#bdb6da] hover:bg-[#faf9ff]"
              href={`/dashboard/orders/${shipment.order.id}`}
            >
              Open order
            </Link>
          ) : null}
          <TrackingRefreshButton shipmentId={shipment.id} />
        </span>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-[#faf9ff] px-4 py-3">
        <StatusPill internalStatus={shipment.status} providerStatus={shipment.providerStatus} />
        <AutoSyncNote autoSync={shipment.autoSync} lastSyncedAt={shipment.lastSyncedAt} />
      </div>

      <dl className="grid grid-cols-[minmax(120px,0.6fr)_minmax(0,1fr)] gap-x-5 gap-y-3.5 text-xs sm:grid-cols-[minmax(120px,0.4fr)_minmax(0,1fr)_minmax(120px,0.4fr)_minmax(0,1fr)]">
        <Row label="Tracking code" value={shipment.trackingCode} mono />
        <Row label="Consignment" value={shipment.providerShipmentId} mono />
        <Row label="Invoice" value={shipment.invoiceReference} mono />
        <Row
          label="COD amount"
          value={shipment.order ? formatMoney(shipment.codAmount, shipment.order.currency) : String(shipment.codAmount)}
        />
        <Row label="Customer" value={shipment.order?.customerName ?? null} />
        <Row label="Phone" value={shipment.order?.customerPhone ?? null} mono />
        <Row label="Booked" value={shipment.bookedAt ? formatDate(shipment.bookedAt) : null} />
        <Row label="Delivered" value={shipment.deliveredAt ? formatDate(shipment.deliveredAt) : null} />
      </dl>

      {shipment.lastError ? (
        <p className="m-0 mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700">
          {shipment.lastError}
        </p>
      ) : null}

      <DeliveryTimeline events={shipment.events} />
    </section>
  );
}

/**
 * Shares `refreshShipmentStatusAction` with the order page rather than adding a
 * second refresh path — both are just requests for the same StatusUpdate, and a
 * second implementation would be a second thing to keep correct.
 */
function TrackingRefreshButton({ shipmentId }: { shipmentId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <span className="grid gap-1">
      <button
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dcd9e8] bg-white px-3 text-[11px] font-semibold text-[#5f616d] transition hover:border-[#bdb6da] hover:bg-[#faf9ff] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshShipmentStatusAction(shipmentId);
            setMessage(result.message ?? null);
          })
        }
        type="button"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCcw className="h-3.5 w-3.5" />
        )}
        {isPending ? "Checking…" : "Refresh"}
      </button>
      {message ? <span className="text-[10px] leading-4 text-[#858691]">{message}</span> : null}
    </span>
  );
}

export function DeliveryTimeline({
  events
}: {
  events: Array<{
    id: string;
    message: string | null;
    occurredAt: Date;
    providerStatus?: string | null | undefined;
    source: string;
    status: string;
  }>;
}) {
  if (events.length === 0) {
    return (
      <p className="m-0 mt-4 border-t border-[#f0eff7] pt-4 text-[11px] text-[#858691]">
        No delivery updates yet. They appear here as the courier reports them.
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-[#f0eff7] pt-4">
      <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-[#777985]">
        Delivery history
      </h3>
      <ol className="m-0 mt-3 grid list-none gap-0 p-0">
        {events.map((event, index) => (
          <li className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3" key={event.id}>
            <span aria-hidden="true" className="grid justify-items-center">
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-[#7548f5]" : "bg-[#d8d5e6]"}`}
              />
              {index < events.length - 1 ? <span className="h-full w-px bg-[#ebe9f4]" /> : null}
            </span>
            <span className="grid gap-0.5 pb-4 text-[11px] leading-5">
              <span className="font-medium text-[#292a34]">{event.message ?? event.status}</span>
              <span className="text-[#858691]">
                {formatDate(event.occurredAt)} · {sourceLabel(event.source)}
                {event.providerStatus ? ` · ${event.providerStatus}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AutoSyncNote({
  autoSync,
  lastSyncedAt
}: {
  autoSync: { enabled: boolean; lastSeenAt: Date | null };
  lastSyncedAt: Date | null;
}) {
  const checked = lastSyncedAt ? `checked ${formatDate(lastSyncedAt)}` : "not checked yet";

  if (!autoSync.enabled) {
    return (
      <span className="text-[11px] text-[#858691]">
        Auto-sync is off — {checked}.{" "}
        <Link className="font-semibold text-[#6d3cf5] hover:underline" href="/dashboard/settings/courier">
          Set up the courier webhook
        </Link>{" "}
        so this updates itself.
      </span>
    );
  }

  return (
    <span className="text-[11px] text-[#858691]">
      Auto-syncing from the courier · {checked}
      {autoSync.lastSeenAt ? ` · last courier update ${formatDate(autoSync.lastSeenAt)}` : ""}
    </span>
  );
}

/**
 * The carrier's own string, verbatim — a seller chasing a parcel with courier
 * support needs the exact token the courier uses. Colour comes from our internal
 * mapping, which is what keeps `delivered_approval_pending` amber rather than
 * reading as a completed delivery.
 */
function StatusPill({
  internalStatus,
  providerStatus
}: {
  internalStatus: string;
  providerStatus: string | null;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${statusTone(internalStatus)}`}
      title={`Mapped internally to ${internalStatus}`}
    >
      {providerStatus ?? internalStatus.toLowerCase()}
    </span>
  );
}

function statusTone(internalStatus: string) {
  if (internalStatus === "DELIVERED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    ["BOOKED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "PARTIALLY_DELIVERED", "PICKED_UP"].includes(
      internalStatus
    )
  ) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (["CANCELLED", "FAILED", "LOST", "RETURNED"].includes(internalStatus)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function Row({ label, mono = false, value }: { label: string; mono?: boolean; value: string | null }) {
  return (
    <>
      <dt className="text-[#777985]">{label}</dt>
      <dd className={`m-0 font-medium text-[#292a34] ${mono ? "font-mono text-[11px]" : ""}`}>
        {value ?? "—"}
      </dd>
    </>
  );
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

function toneClass(status: TrackOrderActionState["status"]) {
  if (status === "success") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "warning") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-rose-50 text-rose-700";
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
