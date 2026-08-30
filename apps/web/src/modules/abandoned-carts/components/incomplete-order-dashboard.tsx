"use client";

import {
  CircleAlert,
  ClipboardList,
  Mail,
  MessageCircle,
  PackageX,
  Percent,
  Plus,
  TrendingDown,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { SummaryMetricCard } from "../../../components/dashboard/summary-metric-card";
import {
  markAbandonedCartContactedAction,
  markAbandonedCartRecoveredAction
} from "../abandoned-cart.actions";
import {
  ActionButton,
  ActionLink,
  callLink,
  CartStatusBadge,
  emailLink,
  formatDate,
  formatDuration,
  formatMoney,
  whatsappLink
} from "./cart-recovery-ui";
import { PlanUpgradeDialog } from "../../billing/components/plan-upgrade-dialog";
import type { PlanFeatureKey } from "../../billing/plan-features";
import type {
  AbandonedCartOutreachChannel,
  AbandonedCartStage,
  AbandonedCartStatus,
  IncompleteOrderAddress,
  IncompleteOrderRecord
} from "../abandoned-cart.types";
import type { IncompleteOrderFilterKey } from "./incomplete-order-list-controls";
import { incompleteOrderFailureLabels } from "../incomplete-order-labels";

type IncompleteOrderDashboardProps = {
  activeCheckoutCount: number;
  activeFilter: IncompleteOrderFilterKey;
  currency: string;
  inactivityMinutes: number;
  orders: IncompleteOrderRecord[];
  search: string;
  storeName: string;
};

export function IncompleteOrderDashboard({
  activeCheckoutCount,
  activeFilter,
  currency,
  inactivityMinutes,
  orders,
  search,
  storeName
}: IncompleteOrderDashboardProps) {
  const [records, setRecords] = useState(orders);
  const [loadedOrders, setLoadedOrders] = useState(orders);
  const [selectedOrder, setSelectedOrder] = useState<IncompleteOrderRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [lockedFeature, setLockedFeature] = useState<PlanFeatureKey | null>(null);
  const [isSaving, startSaving] = useTransition();

  // Filtering/searching re-renders this component with a fresh server list; without
  // this the local copy would keep showing the first page's orders forever.
  if (loadedOrders !== orders) {
    setLoadedOrders(orders);
    setRecords(orders);
  }

  useEffect(() => {
    if (!selectedOrder) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelectedOrder(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selectedOrder]);

  const visibleRecords = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    return records.filter((order) => {
      const filterMatches =
        activeFilter === "all" || activeFilter === "clean" || orderToFilter(order) === activeFilter;
      const searchMatches =
        !normalizedSearch ||
        [order.customerName, order.email ?? "", order.phone ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        );
      return filterMatches && searchMatches;
    });
  }, [activeFilter, records, search]);

  const recovered = records.filter((order) => order.status === "RECOVERED");
  const failed = records.filter((order) => order.stage === "CHECKOUT_FAILED");
  const lostRevenue = records
    .filter((order) => order.status !== "RECOVERED")
    .reduce((total, order) => total + order.cartValue, 0);
  const recoveryRate = records.length ? (recovered.length / records.length) * 100 : 0;

  function applyStatus(
    id: string,
    status: AbandonedCartStatus,
    channel: AbandonedCartOutreachChannel = "manual"
  ) {
    const previous = records;

    setRecords((current) =>
      current.map((order) => (order.id === id ? { ...order, status } : order))
    );
    startSaving(async () => {
      try {
        const result =
          status === "RECOVERED"
            ? await markAbandonedCartRecoveredAction(id, "incomplete_orders")
            : await markAbandonedCartContactedAction(id, channel, "incomplete_orders");

        // The plan does not include recovery: roll the optimistic change back
        // and explain it, rather than showing a generic "could not save".
        if (result.status === "locked") {
          setRecords(previous);
          setLockedFeature(result.feature);
          return;
        }

        if (status === "RECOVERED") {
          setNotice("Order marked as recovered.");
          return;
        }

        setNotice(
          channel === "manual"
            ? "Order marked as contacted."
            : "Message opened — order marked as contacted."
        );
      } catch {
        setRecords(previous);
        setNotice("That change could not be saved. Please try again.");
      }
    });
  }

  /**
   * Outreach is a link, not an integration: the seller's own mail client or
   * WhatsApp opens with the message prefilled, and the order is only marked
   * contacted once that has actually happened.
   */
  function startOutreach(order: IncompleteOrderRecord, channel: "email" | "whatsapp") {
    const target =
      channel === "email"
        ? emailLink(order, storeName, "checkout")
        : whatsappLink(order, storeName, "checkout");

    if (!target) {
      setNotice(
        channel === "email"
          ? "This order has no email address on file."
          : "This order has no phone number on file."
      );
      return;
    }

    window.open(target, "_blank", "noopener,noreferrer");
    applyStatus(order.id, "CONTACTED", channel);
  }

  return (
    <div className="grid min-w-0 gap-5">
      <PlanUpgradeDialog feature={lockedFeature} onClose={() => setLockedFeature(null)} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard
          icon={ClipboardList}
          label="Incomplete Orders"
          value={String(records.length)}
        />
        <SummaryMetricCard
          icon={CircleAlert}
          label="Failed at Checkout"
          value={String(failed.length)}
        />
        <SummaryMetricCard
          icon={Percent}
          label="Recovery Rate"
          value={`${recoveryRate.toFixed(1)}%`}
        />
        <SummaryMetricCard
          icon={TrendingDown}
          label="Lost Revenue"
          value={formatMoney(lostRevenue, currency)}
        />
      </div>

      {notice ? (
        <div
          className="flex items-center justify-between rounded-lg border border-[#ded5ff] bg-[#f7f4ff] px-4 py-3 text-sm text-[#5f3dc4]"
          role="status"
        >
          <span>{notice}</span>
          <button
            aria-label="Dismiss message"
            className="text-[#7450e8]"
            onClick={() => setNotice("")}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="min-w-0 rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <div className="border-b border-[#ececf5] px-5 py-4">
          <h2 className="m-0 text-base font-semibold text-[#20212a]">Incomplete Orders</h2>
          <p className="mb-0 mt-1 text-xs text-[#85869a]">
            Customers who filled in the checkout form but never got an order out of it. A refused
            attempt is listed straight away; one that was only half typed appears after{" "}
            {formatDuration(inactivityMinutes)} of silence.
            {activeCheckoutCount
              ? ` ${formatCheckoutCount(activeCheckoutCount)} in checkout right now — not listed yet.`
              : ""}
          </p>
        </div>

        {visibleRecords.length ? (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
              <thead className="bg-[#f8f8fb] text-xs font-semibold text-[#555762]">
                <tr>
                  {[
                    "Customer",
                    "Phone",
                    "Delivery",
                    "Items",
                    "Order Value",
                    "Stage",
                    "Why It Stopped",
                    "Last Activity",
                    "Status",
                    "Actions"
                  ].map((heading) => (
                    <th className="px-5 py-3" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((order) => (
                  <tr
                    className="border-t border-[#eeeef5] align-top text-[#30313d] transition hover:bg-[#faf9ff]"
                    key={order.id}
                  >
                    <td className="px-5 py-4">
                      <p className="m-0 font-medium">{order.customerName}</p>
                      {order.email ? (
                        <p className="mb-0 mt-1 text-xs text-[#85869a]">{order.email}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      {order.phone ? (
                        <a
                          className="text-[#6d3cf5] hover:underline"
                          href={callLink(order.phone) ?? undefined}
                        >
                          {order.phone}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-5 py-4"
                      title={formatAddress(order.address) ?? ""}
                    >
                      {formatAddress(order.address) ?? "-"}
                    </td>
                    <td className="px-5 py-4">
                      {order.items.reduce((total, item) => total + item.quantity, 0)}
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {formatMoney(order.cartValue, order.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <StageBadge stage={order.stage} />
                      {order.attemptCount > 1 ? (
                        <p className="mb-0 mt-1 text-[11px] text-[#85869a]">
                          {order.attemptCount} attempts
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-[240px] px-5 py-4">
                      {order.failureCode ? (
                        <>
                          <span className="text-[13px] font-medium">
                            {incompleteOrderFailureLabels[order.failureCode]}
                          </span>
                          {order.failureReason ? (
                            <p
                              className="mb-0 mt-1 truncate text-[11px] text-[#85869a]"
                              title={order.failureReason}
                            >
                              {order.failureReason}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[#a2a3b0]">Never submitted</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      {formatDate(order.lastActivity)}
                    </td>
                    <td className="px-5 py-4">
                      <CartStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {order.status === "RECOVERED" ? null : (
                          <ActionLink
                            emphasis
                            href={createOrderHref(order.id)}
                            icon={Plus}
                            label="Create Order"
                          />
                        )}
                        <ActionButton label="View" onClick={() => setSelectedOrder(order)} />
                        <ActionButton
                          disabled={isSaving}
                          icon={MessageCircle}
                          label="WhatsApp"
                          onClick={() => startOutreach(order, "whatsapp")}
                        />
                        <ActionButton
                          disabled={isSaving}
                          icon={Mail}
                          label="Email"
                          onClick={() => startOutreach(order, "email")}
                        />
                        {order.status === "NOT_CONTACTED" ? (
                          <ActionButton
                            disabled={isSaving}
                            label="Mark Contacted"
                            onClick={() => applyStatus(order.id, "CONTACTED")}
                          />
                        ) : null}
                        {order.status !== "RECOVERED" ? (
                          <ActionButton
                            disabled={isSaving}
                            label="Mark Recovered"
                            onClick={() => applyStatus(order.id, "RECOVERED")}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <IncompleteOrderEmptyState
            activeCheckoutCount={activeCheckoutCount}
            inactivityMinutes={inactivityMinutes}
          />
        )}
      </section>

      {selectedOrder ? (
        <IncompleteOrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      ) : null}
    </div>
  );
}

function IncompleteOrderEmptyState({
  activeCheckoutCount,
  inactivityMinutes
}: {
  activeCheckoutCount: number;
  inactivityMinutes: number;
}) {
  return (
    <div className="flex min-h-[390px] flex-col items-center justify-center px-5 py-14 text-center">
      <div className="relative mb-5 grid h-24 w-24 place-items-center rounded-2xl bg-[#f3efff] text-[#7950f2]">
        <PackageX aria-hidden="true" className="h-14 w-14" strokeWidth={1.4} />
      </div>
      <h2 className="m-0 text-xl font-semibold text-[#20212a]">No Incomplete Orders</h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-[#85869a]">
        An order shows up here when a customer fills in the checkout form and then either walks away
        from it for {formatDuration(inactivityMinutes)} or is refused when they press Place Order.
      </p>
      {activeCheckoutCount ? (
        <p className="mt-2 max-w-lg text-sm leading-6 text-[#6d3cf5]">
          {formatCheckoutCount(activeCheckoutCount)} in checkout right now.
        </p>
      ) : null}
      <Link
        className="mt-5 rounded-lg border border-[#7548f5] px-4 py-2 text-sm font-semibold text-[#6d3cf5] transition hover:bg-[#f5f1ff]"
        href="/dashboard/reports/incomplete-orders"
      >
        View Checkout Report
      </Link>
    </div>
  );
}

function IncompleteOrderDrawer({
  order,
  onClose
}: {
  order: IncompleteOrderRecord;
  onClose: () => void;
}) {
  return (
    <div
      aria-labelledby="incomplete-order-title"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex bg-[#20212a]/45"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
    >
      <aside className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-[-12px_0_30px_rgba(32,33,42,0.14)]">
        <header className="flex items-start justify-between border-b border-[#ececf5] px-6 py-5">
          <div>
            <h2 className="m-0 text-lg font-semibold text-[#20212a]" id="incomplete-order-title">
              Incomplete Order
            </h2>
            <p className="mb-0 mt-1 text-xs text-[#85869a]">
              Last active {formatDate(order.lastActivity)}
            </p>
          </div>
          <button
            aria-label="Close order details"
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section className="rounded-lg bg-[#f8f7fd] p-4">
            <h3 className="m-0 text-sm font-semibold">Customer Info</h3>
            <p className="mb-0 mt-3 text-sm font-medium">{order.customerName}</p>
            <p className="mb-0 mt-1 text-xs text-[#757684]">{order.email ?? "No email"}</p>
            <p className="mb-0 mt-1 text-xs text-[#757684]">{order.phone ?? "No phone"}</p>
          </section>

          <section className="mt-5">
            <h3 className="m-0 text-sm font-semibold">Delivery details</h3>
            <p className="mb-0 mt-2 text-sm leading-6 text-[#4f505b]">
              {formatAddress(order.address) ?? "Nothing was typed in yet."}
            </p>
            {/*
              What the shopper had chosen, not what they were charged: no order
              exists, so this is only the seller's starting point for the call.
              The price is worked out again if the order is ever placed.
            */}
            <dl className="mt-3 grid gap-2 text-xs text-[#757684]">
              <DetailRow label="Payment method" value={order.paymentMethod} />
              <DetailRow label="Coupon" value={order.couponCode} />
              <DetailRow label="Place Order pressed" value={String(order.attemptCount)} />
              <DetailRow label="IP address" value={order.ipAddress} />
            </dl>
          </section>

          {order.failureCode ? (
            <section className="mt-5 rounded-lg border border-[#ffd9e0] bg-[#fff5f7] p-4">
              <h3 className="m-0 text-sm font-semibold text-[#a3203a]">
                {incompleteOrderFailureLabels[order.failureCode]}
              </h3>
              {order.failureReason ? (
                <p className="mb-0 mt-2 text-xs leading-5 text-[#8c3049]">{order.failureReason}</p>
              ) : null}
              {order.failedAt ? (
                <p className="mb-0 mt-2 text-[11px] text-[#a8657a]">{formatDate(order.failedAt)}</p>
              ) : null}
            </section>
          ) : null}

          <section className="mt-5">
            <h3 className="m-0 text-sm font-semibold">Products</h3>
            <div className="mt-3 divide-y divide-[#ececf5] border-y border-[#ececf5]">
              {order.items.map((item) => (
                <div className="flex justify-between gap-4 py-4 text-sm" key={item.id}>
                  <div>
                    <p className="m-0 font-medium">{item.productName}</p>
                    <p className="mb-0 mt-1 text-xs text-[#85869a]">Quantity: {item.quantity}</p>
                  </div>
                  <strong>{formatMoney(item.price * item.quantity, order.currency)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h3 className="m-0 text-sm font-semibold">Recovery link</h3>
            <p className="mb-0 mt-2 break-all text-xs text-[#757684]">{order.recoveryUrl}</p>
            <p className="mb-0 mt-2 text-xs text-[#85869a]">
              Opening this link rebuilds this cart on the storefront so the customer can finish
              checking out themselves.
            </p>
          </section>
        </div>
        <footer className="border-t border-[#ececf5] px-6 py-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#626370]">Order Value</span>
            <strong className="text-xl text-[#20212a]">
              {formatMoney(order.cartValue, order.currency)}
            </strong>
          </div>
          {order.status === "RECOVERED" ? null : (
            <Link
              className="mt-4 flex h-10 items-center justify-center rounded-lg bg-[#7548f5] text-sm font-semibold text-white transition hover:bg-[#6436e8]"
              href={createOrderHref(order.id)}
            >
              Create this order
            </Link>
          )}
        </footer>
      </aside>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="m-0">{label}</dt>
      <dd className="m-0 text-right font-medium text-[#4f505b]">{value || "-"}</dd>
    </div>
  );
}

function StageBadge({ stage }: { stage: AbandonedCartStage }) {
  const styles =
    stage === "CHECKOUT_FAILED" ? "bg-[#ffe8ed] text-[#c22f47]" : "bg-[#fff1df] text-[#a7650c]";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}
    >
      {stage === "CHECKOUT_FAILED" ? "Failed" : "Not Submitted"}
    </span>
  );
}

/**
 * The Create Order form, seeded from this checkout.
 *
 * A link rather than a one-click convert: nothing here was confirmed by the
 * customer, so the seller reads it back to them on the phone and saves it
 * themselves. Converting silently would ship parcels nobody agreed to.
 */
function createOrderHref(id: string) {
  return `/dashboard/orders/new?fromIncomplete=${encodeURIComponent(id)}`;
}

/** The furthest thing that happened to this checkout, as one bucket. */
function orderToFilter(order: IncompleteOrderRecord): IncompleteOrderFilterKey {
  if (order.status === "RECOVERED") {
    return "recovered";
  }

  if (order.status === "CONTACTED") {
    return "contacted";
  }

  return order.stage === "CHECKOUT_FAILED" ? "failed" : "started";
}

function formatAddress(address: IncompleteOrderAddress) {
  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.area,
    address.city,
    address.district,
    address.postalCode
  ].filter((part): part is string => Boolean(part?.trim()));

  return parts.length ? parts.join(", ") : null;
}

function formatCheckoutCount(count: number) {
  return `${count} customer${count === 1 ? " is" : "s are"}`;
}
