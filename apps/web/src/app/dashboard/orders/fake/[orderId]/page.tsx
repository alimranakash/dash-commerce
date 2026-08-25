import Link from "next/link";
import { AlertTriangle, Bot, MessageCircle, PhoneCall, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { BlockOrderIpButton } from "../../../../../modules/blocked-ips/components/blocked-ip-buttons";
import { isIpBlocked } from "../../../../../modules/blocked-ips/blocked-ip.enforcement";
import { FakeOrderActionButtons } from "../../../../../modules/fake-orders/components/fake-order-action-buttons";
import { CustomerFlagBadge, RiskLevelBadge, VerificationStatusBadge } from "../../../../../modules/fake-orders/components/fake-order-badges";
import { getFakeOrderDetails } from "../../../../../modules/fake-orders/fake-order.service";
import { isCourierVerificationRequired } from "../../../../../modules/fake-orders/fake-order.verification";
import type { CustomerFlagStatus } from "../../../../../modules/fake-orders/fake-order.types";
import { requireStore } from "../../../../../modules/stores/queries";

type FakeOrderDetailsPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function FakeOrderDetailsPage({ params }: FakeOrderDetailsPageProps) {
  const store = await requireStore();
  const { orderId } = await params;
  const [details, verificationRequired] = await Promise.all([
    getFakeOrderDetails(store.id, orderId),
    isCourierVerificationRequired(store.id)
  ]);

  if (!details) {
    notFound();
  }

  const { assessment, cancellationHistory, order, previousOrders } = details;
  const ipAlreadyBlocked = await isIpBlocked(store.id, order.ipAddress);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <header className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="m-0 text-[11px] font-semibold uppercase text-[#7c3aed]">Fake Order Details</p>
              <h1 className="mt-1.5 text-[1.75rem] font-semibold leading-tight text-[#20212a]">{order.orderNumber}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <RiskLevelBadge level={assessment.level} />
                <VerificationStatusBadge status={order.verificationStatus} />
                <CustomerFlagBadge status={(order.customer?.flagStatus ?? "NORMAL") as CustomerFlagStatus} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="secondary link-button" href="/dashboard/orders/fake">
                Back
              </Link>
              <Link className="secondary link-button" href={`/dashboard/orders/${order.id}`}>
                Original Order
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <section className="panel-card p-5">
            <h2 className="m-0 text-base font-semibold text-[#20212c]">Customer Information</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Info label="Customer" value={order.customerName} />
              <Info label="Phone" value={order.customerPhone} />
              <Info label="Email" value={order.customerEmail ?? "Not provided"} />
              <Info label="Customer Flag" value={order.customer?.flagStatus ?? "NORMAL"} />
              <Info className="sm:col-span-2" label="Delivery Address" value={addressText(order.shippingAddress)} />
            </div>
          </section>

          <section className="panel-card p-5">
            <h2 className="m-0 text-base font-semibold text-[#20212c]">Current Risk Score</h2>
            <div className="mt-5 rounded-2xl border border-[#efedf8] bg-[#fbfaff] p-5 text-center">
              <strong className="block text-5xl font-semibold tracking-tight text-[#20212c]">{assessment.score}</strong>
              <span className="mt-2 inline-flex text-sm text-[#74758a]">out of 100</span>
              <div className="mt-4"><RiskLevelBadge level={assessment.level} /></div>
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="panel-card p-5">
            <h2 className="m-0 text-base font-semibold text-[#20212c]">Risk Factors</h2>
            {assessment.factors.length ? (
              <div className="mt-4 space-y-3">
                {assessment.factors.map((factor) => (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#efeff5] bg-white p-3" key={factor.label}>
                    <span className="inline-flex items-center gap-2 text-sm text-[#30313d]"><AlertTriangle className="h-4 w-4 text-amber-500" />{factor.label}</span>
                    <strong className="text-sm text-[#20212c]">+{factor.points}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-5 text-sm text-[#74758a]">No risk factors detected for this order.</p>
            )}
          </section>

          <section className="panel-card p-5">
            <h2 className="m-0 text-base font-semibold text-[#20212c]">Verification Actions</h2>
            <p className="mt-2 text-sm text-[#74758a]">
              {verificationRequired
                ? "Checkout is unaffected, but this store blocks courier booking until an order is marked verified."
                : "Manual actions update only this review workflow and do not alter checkout or courier behavior."}
            </p>
            <div className="mt-5">
              <FakeOrderActionButtons orderId={order.id} />
            </div>
            {/*
              The address is shown next to its own button rather than among the
              customer fields: on its own it means little to a seller, and the
              only thing they can usefully do with it is the thing beside it.
            */}
            {order.ipAddress ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#efeff5] bg-[#fbfaff] p-3">
                <div>
                  <p className="m-0 text-[11px] font-semibold uppercase text-[#7b7c88]">Order IP address</p>
                  <p className="m-0 mt-1 text-sm font-semibold text-[#20212c]">{order.ipAddress}</p>
                </div>
                {ipAlreadyBlocked ? (
                  <Link className="text-xs font-semibold text-[#6d3cf5]" href="/dashboard/orders/blocked-ips">
                    Already blocked
                  </Link>
                ) : (
                  <BlockOrderIpButton ipAddress={order.ipAddress} orderId={order.id} />
                )}
              </div>
            ) : null}
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <HistoryCard currency={order.currency} orders={previousOrders} title="Previous Order History" />
          <HistoryCard currency={order.currency} orders={cancellationHistory} title="Cancellation History" />
        </div>

        <section className="panel-card p-5">
          <h2 className="m-0 text-base font-semibold text-[#20212c]">Future Verification Tools</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FutureCard icon={<Bot className="h-4 w-4" />} label="AI Risk Detection" />
            <FutureCard icon={<PhoneCall className="h-4 w-4" />} label="Phone Verification" />
            <FutureCard icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp Verification" />
            <FutureCard icon={<ShieldCheck className="h-4 w-4" />} label="SMS OTP Verification" />
          </div>
        </section>
      </section>
    </DashboardShell>
  );
}

function Info({ className = "", label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={`rounded-xl border border-[#efeff5] bg-[#fbfaff] p-4 ${className}`}>
      <p className="m-0 text-[11px] font-semibold uppercase text-[#7b7c88]">{label}</p>
      <p className="m-0 mt-1 text-sm font-semibold text-[#20212c]">{value}</p>
    </div>
  );
}

function HistoryCard({
  currency,
  orders,
  title
}: {
  currency: string;
  orders: Array<{ createdAt: Date; id: string; orderNumber: string; status: string; totalAmount: unknown }>;
  title: string;
}) {
  return (
    <section className="panel-card p-5">
      <h2 className="m-0 text-base font-semibold text-[#20212c]">{title}</h2>
      {orders.length ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#efeff5]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-[#f7f7fa] text-[#565762]">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efeff5]">
              {orders.map((historyOrder) => (
                <tr key={historyOrder.id}>
                  <td className="px-4 py-3 font-semibold text-[#6d3cf5]">{historyOrder.orderNumber}</td>
                  <td className="px-4 py-3">{formatMoney(historyOrder.totalAmount, currency)}</td>
                  <td className="px-4 py-3">{historyOrder.status}</td>
                  <td className="px-4 py-3 text-[#565762]">{formatDate(historyOrder.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-5 text-sm text-[#74758a]">No matching history found.</p>
      )}
    </section>
  );
}

function FutureCard({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-[#efeff5] bg-[#fbfaff] p-4">
      <div className="mb-3 inline-flex rounded-lg bg-[#f3f0ff] p-2 text-[#7c3aed]">{icon}</div>
      <p className="m-0 text-sm font-semibold text-[#20212c]">{label}</p>
      <p className="m-0 mt-1 text-xs text-[#74758a]">Coming soon</p>
    </div>
  );
}

function addressText(address: {
  addressLine1: string;
  addressLine2: string | null;
  area: string | null;
  city: string | null;
  country: string;
  district: string;
} | null) {
  if (!address) return "Not provided";
  return [address.addressLine1, address.addressLine2, address.area, address.city, address.district, address.country]
    .filter(Boolean)
    .join(", ");
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}
