"use client";

import {
  CircleDollarSign,
  FileX2,
  Mail,
  MessageCircle,
  Percent,
  ShoppingCart,
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
  AbandonedCartRecord,
  AbandonedCartStatus
} from "../abandoned-cart.types";
import type { AbandonedCartFilterKey } from "./abandoned-cart-list-controls";

type AbandonedCartDashboardProps = {
  activeCartCount: number;
  activeFilter: AbandonedCartFilterKey;
  carts: AbandonedCartRecord[];
  currency: string;
  inactivityMinutes: number;
  search: string;
  storeName: string;
};

export function AbandonedCartDashboard({ activeCartCount, activeFilter, carts, currency, inactivityMinutes, search, storeName }: AbandonedCartDashboardProps) {
  const [records, setRecords] = useState(carts);
  const [loadedCarts, setLoadedCarts] = useState(carts);
  const [selectedCart, setSelectedCart] = useState<AbandonedCartRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [lockedFeature, setLockedFeature] = useState<PlanFeatureKey | null>(null);
  const [isSaving, startSaving] = useTransition();

  // Filtering/searching re-renders this component with a fresh server list; without
  // this the local copy would keep showing the first page's carts forever.
  if (loadedCarts !== carts) {
    setLoadedCarts(carts);
    setRecords(carts);
  }

  useEffect(() => {
    if (!selectedCart) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelectedCart(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selectedCart]);

  const visibleRecords = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    return records.filter((cart) => {
      const statusMatches = activeFilter === "all" || activeFilter === "clean" || statusToFilter(cart.status) === activeFilter;
      const searchMatches = !normalizedSearch || [cart.customerName, cart.email ?? "", cart.phone ?? ""].some((value) => value.toLowerCase().includes(normalizedSearch));
      return statusMatches && searchMatches;
    });
  }, [activeFilter, records, search]);

  const recovered = records.filter((cart) => cart.status === "RECOVERED");
  const recoveredRevenue = recovered.reduce((total, cart) => total + cart.cartValue, 0);
  const lostRevenue = records.filter((cart) => cart.status !== "RECOVERED").reduce((total, cart) => total + cart.cartValue, 0);
  const recoveryRate = records.length ? (recovered.length / records.length) * 100 : 0;

  function applyStatus(id: string, status: AbandonedCartStatus, channel: AbandonedCartOutreachChannel = "manual") {
    const previous = records;

    setRecords((current) => current.map((cart) => cart.id === id ? { ...cart, status } : cart));
    startSaving(async () => {
      try {
        const result = status === "RECOVERED"
          ? await markAbandonedCartRecoveredAction(id)
          : await markAbandonedCartContactedAction(id, channel);

        // The plan does not include recovery: roll the optimistic change back
        // and explain it, rather than showing a generic "could not save".
        if (result.status === "locked") {
          setRecords(previous);
          setLockedFeature(result.feature);
          return;
        }

        if (status === "RECOVERED") {
          setNotice("Cart marked as recovered.");
          return;
        }

        setNotice(channel === "manual" ? "Cart marked as contacted." : "Recovery message opened — cart marked as contacted.");
      } catch {
        setRecords(previous);
        setNotice("That change could not be saved. Please try again.");
      }
    });
  }

  /**
   * Outreach is a link, not an integration: the seller's own mail client or
   * WhatsApp opens with the message prefilled, and the cart is only marked
   * contacted once that has actually happened.
   */
  function startOutreach(cart: AbandonedCartRecord, channel: "email" | "whatsapp") {
    const target =
      channel === "email"
        ? emailLink(cart, storeName, "cart")
        : whatsappLink(cart, storeName, "cart");

    if (!target) {
      setNotice(channel === "email" ? "This cart has no email address on file." : "This cart has no phone number on file.");
      return;
    }

    window.open(target, "_blank", "noopener,noreferrer");
    applyStatus(cart.id, "CONTACTED", channel);
  }

  return (
    <div className="grid min-w-0 gap-5">
      <PlanUpgradeDialog feature={lockedFeature} onClose={() => setLockedFeature(null)} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard icon={ShoppingCart} label="Total Abandoned Carts" value={String(records.length)} />
        <SummaryMetricCard icon={Percent} label="Recovery Rate" value={`${recoveryRate.toFixed(1)}%`} />
        <SummaryMetricCard icon={CircleDollarSign} label="Recovered Revenue" value={formatMoney(recoveredRevenue, currency)} />
        <SummaryMetricCard icon={TrendingDown} label="Lost Revenue" value={formatMoney(lostRevenue, currency)} />
      </div>

      {notice ? (
        <div className="flex items-center justify-between rounded-lg border border-[#ded5ff] bg-[#f7f4ff] px-4 py-3 text-sm text-[#5f3dc4]" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss message" className="text-[#7450e8]" onClick={() => setNotice("")} type="button"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      <section className="min-w-0 rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <div className="border-b border-[#ececf5] px-5 py-4">
          <h2 className="m-0 text-base font-semibold text-[#20212a]">Abandoned Cart Recovery</h2>
          <p className="mb-0 mt-1 text-xs text-[#85869a]">Carts left untouched for more than {formatDuration(inactivityMinutes)}. Reach out from here and the cart is marked contacted.{activeCartCount ? ` ${formatCartCount(activeCartCount)} still being shopped right now — not abandoned yet.` : ""}</p>
        </div>

        {visibleRecords.length ? (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
              <thead className="bg-[#f8f8fb] text-xs font-semibold text-[#555762]">
                <tr>{["Customer", "Email", "Phone", "Cart Items", "Cart Value", "Last Activity", "Status", "Actions"].map((heading) => <th className="px-5 py-3" key={heading}>{heading}</th>)}</tr>
              </thead>
              <tbody>
                {visibleRecords.map((cart) => (
                  <tr className="border-t border-[#eeeef5] text-[#30313d] transition hover:bg-[#faf9ff]" key={cart.id}>
                    <td className="px-5 py-4 font-medium">{cart.customerName}</td>
                    <td className="px-5 py-4">{cart.email ?? "-"}</td>
                    <td className="px-5 py-4">{cart.phone ?? "-"}</td>
                    <td className="px-5 py-4">{cart.items.reduce((total, item) => total + item.quantity, 0)}</td>
                    <td className="px-5 py-4 font-semibold">{formatMoney(cart.cartValue, cart.currency)}</td>
                    <td className="px-5 py-4">{formatDate(cart.lastActivity)}</td>
                    <td className="px-5 py-4"><CartStatusBadge status={cart.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <ActionButton label="View Cart" onClick={() => setSelectedCart(cart)} />
                        <ActionButton disabled={isSaving} icon={Mail} label="Send Email" onClick={() => startOutreach(cart, "email")} />
                        <ActionButton disabled={isSaving} icon={MessageCircle} label="Send WhatsApp" onClick={() => startOutreach(cart, "whatsapp")} />
                        {cart.status === "NOT_CONTACTED" ? <ActionButton disabled={isSaving} label="Mark Contacted" onClick={() => applyStatus(cart.id, "CONTACTED")} /> : null}
                        {cart.status !== "RECOVERED" ? <ActionButton disabled={isSaving} label="Mark Recovered" onClick={() => applyStatus(cart.id, "RECOVERED")} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <AbandonedCartEmptyState activeCartCount={activeCartCount} inactivityMinutes={inactivityMinutes} />}
      </section>

      {selectedCart ? <CartDetailsDrawer cart={selectedCart} onClose={() => setSelectedCart(null)} /> : null}
    </div>
  );
}

function AbandonedCartEmptyState({ activeCartCount, inactivityMinutes }: { activeCartCount: number; inactivityMinutes: number }) {
  return (
    <div className="flex min-h-[390px] flex-col items-center justify-center px-5 py-14 text-center">
      <div className="relative mb-5 grid h-24 w-24 place-items-center rounded-2xl bg-[#f3efff] text-[#7950f2]">
        <FileX2 aria-hidden="true" className="h-16 w-16" fill="#e9e3ff" strokeWidth={1.4} />
        <ShoppingCart aria-hidden="true" className="absolute h-8 w-8" strokeWidth={2} />
      </div>
      <h2 className="m-0 text-xl font-semibold text-[#20212a]">No Abandoned Carts Found</h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-[#85869a]">A cart shows up here once a customer has left products in it for more than {formatDuration(inactivityMinutes)} without checking out.</p>
      {activeCartCount ? (
        <p className="mt-2 max-w-lg text-sm leading-6 text-[#6d3cf5]">{formatCartCount(activeCartCount)} being shopped right now. If it goes quiet for {formatDuration(inactivityMinutes)}, it will appear here.</p>
      ) : null}
      <Link className="mt-5 rounded-lg border border-[#7548f5] px-4 py-2 text-sm font-semibold text-[#6d3cf5] transition hover:bg-[#f5f1ff]" href="/dashboard/reports/abandoned-carts">View Recovery Report</Link>
    </div>
  );
}

function CartDetailsDrawer({ cart, onClose }: { cart: AbandonedCartRecord; onClose: () => void }) {
  return (
    <div aria-labelledby="cart-details-title" aria-modal="true" className="fixed inset-0 z-[100] flex bg-[#20212a]/45" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <aside className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-[-12px_0_30px_rgba(32,33,42,0.14)]">
        <header className="flex items-start justify-between border-b border-[#ececf5] px-6 py-5">
          <div><h2 className="m-0 text-lg font-semibold text-[#20212a]" id="cart-details-title">Cart Details</h2><p className="mb-0 mt-1 text-xs text-[#85869a]">Last active {formatDate(cart.lastActivity)}</p></div>
          <button aria-label="Close cart details" className="grid h-9 w-9 place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]" onClick={onClose} type="button"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section className="rounded-lg bg-[#f8f7fd] p-4"><h3 className="m-0 text-sm font-semibold">Customer Info</h3><p className="mb-0 mt-3 text-sm font-medium">{cart.customerName}</p><p className="mb-0 mt-1 text-xs text-[#757684]">{cart.email ?? "No email"}</p><p className="mb-0 mt-1 text-xs text-[#757684]">{cart.phone ?? "No phone"}</p></section>
          <section className="mt-5"><h3 className="m-0 text-sm font-semibold">Products</h3><div className="mt-3 divide-y divide-[#ececf5] border-y border-[#ececf5]">{cart.items.map((item) => <div className="flex justify-between gap-4 py-4 text-sm" key={item.id}><div><p className="m-0 font-medium">{item.productName}</p><p className="mb-0 mt-1 text-xs text-[#85869a]">Quantity: {item.quantity}</p></div><strong>{formatMoney(item.price * item.quantity, cart.currency)}</strong></div>)}</div></section>
          <section className="mt-5"><h3 className="m-0 text-sm font-semibold">Recovery link</h3><p className="mb-0 mt-2 break-all text-xs text-[#757684]">{cart.recoveryUrl}</p><p className="mb-0 mt-2 text-xs text-[#85869a]">Opening this link rebuilds this cart on the storefront.</p></section>
        </div>
        <footer className="border-t border-[#ececf5] px-6 py-5"><div className="flex items-center justify-between"><span className="text-sm text-[#626370]">Cart Value</span><strong className="text-xl text-[#20212a]">{formatMoney(cart.cartValue, cart.currency)}</strong></div></footer>
      </aside>
    </div>
  );
}

function statusToFilter(status: AbandonedCartStatus): AbandonedCartFilterKey {
  return status === "NOT_CONTACTED" ? "not-contacted" : status === "CONTACTED" ? "contacted" : "recovered";
}

function formatCartCount(count: number) {
  return `${count} cart${count === 1 ? " is" : "s are"}`;
}
