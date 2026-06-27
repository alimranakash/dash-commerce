"use client";

import { Button } from "@dash/ui";
import { CheckCircle2, Download, Eye, FileText, RefreshCcw, Search, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";
import { markPaymentFailedAction, markPaymentPaidAction } from "../admin-payments.actions";

export type AdminPaymentListItem = {
  amount: string;
  createdAt: string;
  currency: string;
  gateway: "MANUAL" | "OTHER" | "PADDLE" | "SSLCOMMERZ" | "STRIPE";
  id: string;
  invoiceNumber: string;
  ownerEmail: string;
  ownerName: string;
  paidAt: string;
  paymentMethod: string;
  paymentNote: string;
  paymentReference: string;
  planName: string;
  rejectionReason: string;
  senderNumber: string;
  status: "CANCELLED" | "FAILED" | "PAID" | "PENDING" | "REFUNDED";
  storeDomain: string;
  storeName: string;
  subscriptionStatus: string;
  timeline: Array<{
    label: string;
    value: string;
  }>;
};

export type AdminPaymentChartPoint = {
  label: string;
  value: number;
};

type AdminPaymentManagementProps = {
  activeGateway: string;
  activeStatus: string;
  charts: {
    gatewayDistribution: AdminPaymentChartPoint[];
    revenueByMonth: AdminPaymentChartPoint[];
    statusDistribution: AdminPaymentChartPoint[];
  };
  dateRange: string;
  payments: AdminPaymentListItem[];
  revenueSummary: {
    annualRevenue: string;
    arps: string;
    lifetimeRevenue: string;
    monthlyRevenue: string;
  };
  search: string;
};

type PaymentStatusAction = {
  action: (paymentId: string) => Promise<AdminPaymentActionResult>;
  label: string;
  message: string;
  title: string;
};

type AdminPaymentActionResult = {
  message: string;
  ok: boolean;
};

const statusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Failed / Rejected", value: "failed" },
  { label: "Refunded", value: "refunded" },
  { label: "Cancelled", value: "cancelled" }
];

const gatewayOptions = [
  { label: "All gateways", value: "all" },
  { label: "Manual", value: "manual" },
  { label: "SSLCommerz", value: "sslcommerz" },
  { label: "Stripe", value: "stripe" },
  { label: "Paddle", value: "paddle" },
  { label: "Other", value: "other" }
];

export function AdminPaymentManagement({
  activeGateway,
  activeStatus,
  charts,
  dateRange,
  payments,
  revenueSummary,
  search
}: AdminPaymentManagementProps) {
  const router = useRouter();
  const [actionNotice, setActionNotice] = useState<AdminPaymentActionResult | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentListItem | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ action: PaymentStatusAction; payment: AdminPaymentListItem } | null>(null);
  const [placeholder, setPlaceholder] = useState<{ message: string; title: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const hasPayments = payments.length > 0;
  const filterLabel = useMemo(() => {
    const status = statusOptions.find((option) => option.value === activeStatus)?.label ?? "All statuses";
    const gateway = gatewayOptions.find((option) => option.value === activeGateway)?.label ?? "All gateways";
    return `${status} / ${gateway}`;
  }, [activeGateway, activeStatus]);

  function runAction(action: (paymentId: string) => Promise<AdminPaymentActionResult>, paymentId: string, onDone?: () => void) {
    startTransition(async () => {
      try {
        const result = await action(paymentId);
        setActionNotice(result);

        if (result.ok) {
          router.refresh();
          onDone?.();
        }
      } catch (error) {
        setActionNotice({
          message: error instanceof Error ? error.message : "Payment action failed.",
          ok: false
        });
      }
    });
  }

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RevenueCard label="Monthly Revenue" value={revenueSummary.monthlyRevenue} />
        <RevenueCard label="Annual Revenue" value={revenueSummary.annualRevenue} />
        <RevenueCard label="ARPS" value={revenueSummary.arps} />
        <RevenueCard label="Lifetime Revenue" value={revenueSummary.lifetimeRevenue} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ChartCard data={charts.revenueByMonth} kind="bar" title="Revenue by Month" valuePrefix="BDT " />
        <ChartCard data={charts.gatewayDistribution} kind="pill" title="Payments by Gateway" />
        <ChartCard data={charts.statusDistribution} kind="pill" title="Payment Status Distribution" />
      </section>

      <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
        {actionNotice ? (
          <p className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${actionNotice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {actionNotice.message}
          </p>
        ) : null}
        <div className="mb-5 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold text-[#20212c]">Payments</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">Showing {filterLabel.toLowerCase()} platform payments.</p>
          </div>

          <div className="grid gap-3 2xl:grid-cols-[auto_1fr] 2xl:items-center">
            <Link className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-[#dcd7f5] bg-white px-4 text-xs font-semibold text-[#6d3cf5] hover:bg-[#f7f4ff]" href="/admin/payments/settings">
              Manual Payment Settings
            </Link>
            <DashboardQueryForm actionPath="/admin/payments" className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_150px_150px_minmax(170px,1fr)_44px] 2xl:w-[900px]">
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={search}
              name="search"
              placeholder="Search store, owner, invoice, reference"
              type="search"
            />
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activeStatus} name="status">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activeGateway} name="gateway">
              {gatewayOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={dateRange}
              name="dateRange"
              placeholder="eg. 01 Jan 2026 - 31 Jan 2026"
              type="text"
            />
            <button aria-label="Search payments" className="grid h-11 cursor-pointer place-items-center rounded-lg bg-[#7c3aed] text-white hover:bg-[#6d28d9]" type="submit">
              <Search className="h-4 w-4" />
            </button>
            </DashboardQueryForm>
          </div>
        </div>

        {hasPayments ? (
          <div className="overflow-hidden rounded-xl border border-[#efeff5] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
                <thead className="bg-[#f7f7fa] text-[#565762]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Store</th>
                    <th className="px-4 py-3 font-semibold">Owner</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Payment Method</th>
                    <th className="px-4 py-3 font-semibold">Transaction ID</th>
                    <th className="px-4 py-3 font-semibold">Sender Number</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Created At</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efeff5]">
                  {payments.map((payment) => (
                    <tr className="transition hover:bg-[#fbfaff]" key={payment.id}>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#20212c]">{payment.storeName}</div>
                        <div className="mt-1 text-[11px] text-[#74758a]">{payment.invoiceNumber}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#30313d]">{payment.ownerName}</div>
                        <div className="mt-1 text-[11px] text-[#74758a]">{payment.ownerEmail}</div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-[#20212c]">{payment.planName}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#20212c]">{paymentMethodLabel(payment.paymentMethod)}</div>
                        <div className="mt-1"><GatewayBadge gateway={payment.gateway} /></div>
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] text-[#30313d]">{payment.paymentReference}</td>
                      <td className="px-4 py-4 text-[#565762]">{payment.senderNumber}</td>
                      <td className="px-4 py-4 font-semibold text-[#20212c]">{payment.currency} {formatMoney(payment.amount)}</td>
                      <td className="px-4 py-4"><PaymentStatusBadge status={payment.status} /></td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{payment.createdAt}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-1.5">
                          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#6d3cf5] hover:bg-[#f3f0ff]" onClick={() => setSelectedPayment(payment)} title="View payment" type="button">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={pending || payment.status !== "PENDING"} onClick={() => setStatusTarget({ action: paymentStatusActions.paid, payment })} title="Approve payment" type="button">
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={pending || payment.status !== "PENDING"} onClick={() => setStatusTarget({ action: paymentStatusActions.failed, payment })} title="Reject payment" type="button">
                            <XCircle className="h-4 w-4" />
                          </button>
                          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#7c3aed] hover:bg-[#f3f0ff]" onClick={() => setPlaceholder({ message: "Refund processing will be connected when gateway integrations are added.", title: "Refund Placeholder" })} title="Refund" type="button">
                            <RefreshCcw className="h-4 w-4" />
                          </button>
                          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#2563eb] hover:bg-blue-50" onClick={() => setPlaceholder({ message: "Receipt downloads will be generated when invoice PDFs are added.", title: "Receipt Placeholder" })} title="Download receipt" type="button">
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <AdminPaymentsEmpty />
        )}
      </section>

      {selectedPayment ? <PaymentDetailsDrawer onClose={() => setSelectedPayment(null)} payment={selectedPayment} /> : null}
      {statusTarget ? (
        <StatusConfirmModal
          disabled={pending}
          onClose={() => setStatusTarget(null)}
          onConfirm={() => runAction(statusTarget.action.action, statusTarget.payment.id, () => setStatusTarget(null))}
          payment={statusTarget.payment}
          statusAction={statusTarget.action}
        />
      ) : null}
      {placeholder ? <PlaceholderModal message={placeholder.message} onClose={() => setPlaceholder(null)} title={placeholder.title} /> : null}
    </>
  );
}

const paymentStatusActions = {
  failed: {
    action: markPaymentFailedAction,
    label: "Reject Payment",
    message: "This will reject the pending manual payment and keep the subscription inactive.",
    title: "Reject Manual Payment"
  },
  paid: {
    action: markPaymentPaidAction,
    label: "Approve Payment",
    message: "This will approve the manual payment, activate the subscription, and update the billing period.",
    title: "Approve Manual Payment"
  }
} satisfies Record<string, PaymentStatusAction>;

function PaymentDetailsDrawer({ onClose, payment }: { onClose: () => void; payment: AdminPaymentListItem }) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[100] flex justify-end bg-[#20212a]/45" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#efeff5] pb-4">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c3aed]">Payment Details</p>
            <h2 className="m-0 mt-1 text-xl font-semibold text-[#20212c]">{payment.invoiceNumber}</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">{payment.storeName}</p>
          </div>
          <button className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4">
          <DetailSection title="Payment Information">
            <DetailRow label="Invoice" value={payment.invoiceNumber} />
            <DetailRow label="Amount" value={`${payment.currency} ${formatMoney(payment.amount)}`} />
            <DetailRow label="Payment Method" value={payment.paymentMethod} />
            <DetailRow label="Payment Reference" value={payment.paymentReference} />
            <DetailRow label="Sender Number" value={payment.senderNumber} />
            <DetailRow label="Payment Note" value={payment.paymentNote} />
            {payment.rejectionReason !== "Not set" ? <DetailRow label="Rejection Reason" value={payment.rejectionReason} /> : null}
            <div className="mt-3"><PaymentStatusBadge status={payment.status} /></div>
          </DetailSection>
          <DetailSection title="Store Information">
            <DetailRow label="Store" value={payment.storeName} />
            <DetailRow label="Owner" value={payment.ownerName} />
            <DetailRow label="Owner Email" value={payment.ownerEmail} />
            <DetailRow label="Store URL" value={payment.storeDomain} />
          </DetailSection>
          <DetailSection title="Subscription">
            <DetailRow label="Plan" value={payment.planName} />
            <DetailRow label="Subscription Status" value={titleCase(payment.subscriptionStatus)} />
          </DetailSection>
          <DetailSection title="Gateway">
            <DetailRow label="Gateway" value={gatewayLabel(payment.gateway)} />
            <DetailRow label="Paid At" value={payment.paidAt} />
          </DetailSection>
          <DetailSection title="Timeline">
            <div className="grid gap-3">
              {payment.timeline.map((event) => (
                <div className="flex items-start gap-3" key={event.label}>
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#7c3aed]" />
                  <div>
                    <div className="text-xs font-semibold text-[#20212c]">{event.label}</div>
                    <div className="mt-0.5 text-[11px] text-[#74758a]">{event.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </DetailSection>
        </div>
      </aside>
    </div>
  );
}

function StatusConfirmModal({
  disabled,
  onClose,
  onConfirm,
  payment,
  statusAction
}: {
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
  payment: AdminPaymentListItem;
  statusAction: PaymentStatusAction;
}) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[110] grid place-items-center bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
          <FileText className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-center text-xl font-semibold text-[#20212c]">{statusAction.title}</h2>
        <p className="mt-2 text-center text-sm leading-6 text-[#74758a]">
          {statusAction.message} Invoice: {payment.invoiceNumber}.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className="h-11 cursor-pointer rounded-lg border border-[#dedcf0] font-semibold text-[#30313d] hover:bg-[#f7f5ff]" disabled={disabled} onClick={onClose} type="button">Cancel</button>
          <Button className="h-11 cursor-pointer rounded-lg bg-[#7c3aed] font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60" disabled={disabled} onClick={onConfirm} type="button">
            {disabled ? "Updating..." : statusAction.label}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlaceholderModal({ message, onClose, title }: { message: string; onClose: () => void; title: string }) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[110] grid place-items-center bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
          <FileText className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-[#20212c]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#74758a]">{message}</p>
        <Button className="mt-6 h-11 cursor-pointer rounded-lg bg-[#7c3aed] px-5 font-semibold text-white hover:bg-[#6d28d9]" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

function RevenueCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <p className="m-0 text-xs font-medium text-[#74758a]">{label}</p>
      <strong className="mt-2 block text-2xl font-semibold tracking-tight text-[#20212c]">BDT {formatMoney(value)}</strong>
    </div>
  );
}

function ChartCard({ data, kind, title, valuePrefix = "" }: { data: AdminPaymentChartPoint[]; kind: "bar" | "pill"; title: string; valuePrefix?: string }) {
  const max = Math.max(...data.map((item) => item.value), 0);
  const hasData = data.some((item) => item.value > 0);

  return (
    <div className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <h3 className="m-0 text-base font-semibold text-[#20212c]">{title}</h3>
      {hasData ? (
        <div className="mt-5 grid gap-3">
          {data.map((item) => {
            const width = max > 0 ? Math.max(6, Math.round((item.value / max) * 100)) : 0;
            return (
              <div className={kind === "bar" ? "grid gap-1" : "grid gap-1"} key={item.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#565762]">{titleCase(item.label)}</span>
                  <span className="font-semibold text-[#20212c]">{valuePrefix}{kind === "bar" ? formatMoney(String(item.value)) : item.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f0eefb]">
                  <div className="h-full rounded-full bg-[#7c3aed]" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-8 text-center text-sm text-[#74758a]">
          No payment data available yet.
        </div>
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: AdminPaymentListItem["status"] }) {
  const styles = {
    CANCELLED: "bg-red-50 text-red-700 ring-red-100",
    FAILED: "bg-amber-50 text-amber-700 ring-amber-100",
    PAID: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    PENDING: "bg-blue-50 text-blue-700 ring-blue-100",
    REFUNDED: "bg-violet-50 text-violet-700 ring-violet-100"
  }[status];

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>{titleCase(status)}</span>;
}

function GatewayBadge({ gateway }: { gateway: AdminPaymentListItem["gateway"] }) {
  return (
    <span className="inline-flex rounded-full bg-[#f3f0ff] px-2.5 py-1 text-[11px] font-semibold text-[#6d3cf5] ring-1 ring-violet-100">
      {gatewayLabel(gateway)}
    </span>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-[#efeff5] bg-[#fbfaff] p-4">
      <h3 className="m-0 text-sm font-semibold text-[#20212c]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#efeff5] py-2 last:border-b-0">
      <span className="text-xs font-medium text-[#74758a]">{label}</span>
      <span className="text-right text-xs font-semibold text-[#30313d]">{value}</span>
    </div>
  );
}

function AdminPaymentsEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="m-0 text-lg font-semibold text-[#20212c]">No payments found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#74758a]">Platform payment records will appear here when subscriptions are billed.</p>
    </div>
  );
}

function formatMoney(value: string) {
  return Number(value).toLocaleString("en", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function gatewayLabel(gateway: string) {
  if (gateway === "SSLCOMMERZ") return "SSLCommerz";
  return titleCase(gateway);
}

function paymentMethodLabel(paymentMethod: string) {
  const labels: Record<string, string> = {
    BANK: "Bank Transfer",
    BKASH: "bKash",
    NAGAD: "Nagad",
    ROCKET: "Rocket"
  };

  return labels[paymentMethod] ?? titleCase(paymentMethod);
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
