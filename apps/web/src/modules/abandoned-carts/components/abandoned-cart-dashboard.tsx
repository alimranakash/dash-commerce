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
import { useEffect, useMemo, useState } from "react";
import { SummaryMetricCard } from "../../../components/dashboard/summary-metric-card";
import type { AbandonedCartFilterKey } from "./abandoned-cart-list-controls";

export type AbandonedCartStatus = "NOT_CONTACTED" | "CONTACTED" | "RECOVERED";

export type AbandonedCartRecord = {
  cartValue: number;
  currency: string;
  customerName: string;
  email: string | null;
  id: string;
  items: Array<{
    id: string;
    price: number;
    productName: string;
    quantity: number;
  }>;
  lastActivity: string;
  phone: string | null;
  status: AbandonedCartStatus;
};

type AbandonedCartDashboardProps = {
  activeFilter: AbandonedCartFilterKey;
  carts: AbandonedCartRecord[];
  currency: string;
  search: string;
};

export function AbandonedCartDashboard({ activeFilter, carts, currency, search }: AbandonedCartDashboardProps) {
  const [records, setRecords] = useState(carts);
  const [selectedCart, setSelectedCart] = useState<AbandonedCartRecord | null>(null);
  const [notice, setNotice] = useState("");

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

  function updateStatus(id: string, status: AbandonedCartStatus) {
    setRecords((current) => current.map((cart) => cart.id === id ? { ...cart, status } : cart));
    setNotice(status === "RECOVERED" ? "Cart marked as recovered." : "Cart marked as contacted.");
  }

  return (
    <div className="grid min-w-0 gap-5">
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
          <p className="mb-0 mt-1 text-xs text-[#85869a]">Review customer carts and prepare manual recovery outreach.</p>
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
                        <ActionButton icon={Mail} label="Send Email" onClick={() => setNotice("Email recovery will be available when campaigns are connected.")} />
                        <ActionButton icon={MessageCircle} label="Send WhatsApp" onClick={() => setNotice("WhatsApp recovery will be available when campaigns are connected.")} />
                        {cart.status === "NOT_CONTACTED" ? <ActionButton label="Mark Contacted" onClick={() => updateStatus(cart.id, "CONTACTED")} /> : null}
                        {cart.status !== "RECOVERED" ? <ActionButton label="Mark Recovered" onClick={() => updateStatus(cart.id, "RECOVERED")} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <AbandonedCartEmptyState onLearn={() => setNotice("Recovery campaigns will become available when abandoned cart tracking is connected.")} />}
      </section>

      {selectedCart ? <CartDetailsDrawer cart={selectedCart} onClose={() => setSelectedCart(null)} /> : null}
    </div>
  );
}

function AbandonedCartEmptyState({ onLearn }: { onLearn: () => void }) {
  return (
    <div className="flex min-h-[390px] flex-col items-center justify-center px-5 py-14 text-center">
      <div className="relative mb-5 grid h-24 w-24 place-items-center rounded-2xl bg-[#f3efff] text-[#7950f2]">
        <FileX2 aria-hidden="true" className="h-16 w-16" fill="#e9e3ff" strokeWidth={1.4} />
        <ShoppingCart aria-hidden="true" className="absolute h-8 w-8" strokeWidth={2} />
      </div>
      <h2 className="m-0 text-xl font-semibold text-[#20212a]">No Abandoned Carts Found</h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-[#85869a]">Abandoned carts will appear here when customers leave products in their cart without completing checkout.</p>
      <button className="mt-5 rounded-lg border border-[#7548f5] px-4 py-2 text-sm font-semibold text-[#6d3cf5] transition hover:bg-[#f5f1ff]" onClick={onLearn} type="button">Learn About Recovery</button>
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
        </div>
        <footer className="border-t border-[#ececf5] px-6 py-5"><div className="flex items-center justify-between"><span className="text-sm text-[#626370]">Cart Value</span><strong className="text-xl text-[#20212a]">{formatMoney(cart.cartValue, cart.currency)}</strong></div></footer>
      </aside>
    </div>
  );
}

function CartStatusBadge({ status }: { status: AbandonedCartStatus }) {
  const styles = status === "RECOVERED" ? "bg-[#e5f8f2] text-[#11815f]" : status === "CONTACTED" ? "bg-[#eeeaff] text-[#6846d8]" : "bg-[#fff1df] text-[#a7650c]";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}>{status === "NOT_CONTACTED" ? "Not Contacted" : status === "CONTACTED" ? "Contacted" : "Recovered"}</span>;
}

function ActionButton({ icon: Icon, label, onClick }: { icon?: typeof Mail; label: string; onClick: () => void }) {
  return <button className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-[#ded9ef] px-2.5 text-[11px] font-semibold text-[#5f3dc4] hover:bg-[#f5f1ff]" onClick={onClick} type="button">{Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}</button>;
}

function statusToFilter(status: AbandonedCartStatus): AbandonedCartFilterKey {
  return status === "NOT_CONTACTED" ? "not-contacted" : status === "CONTACTED" ? "contacted" : "recovered";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}
