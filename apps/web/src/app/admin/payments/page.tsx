import { AlertCircle, CheckCircle2, Clock3, WalletCards } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "../../../components/admin/admin-ui";
import {
  getAdminPaymentChartData,
  getAdminPaymentMetrics,
  getAdminPaymentRevenueSummary,
  getAdminPayments,
  type AdminPaymentGatewayFilter,
  type AdminPaymentStatusFilter
} from "../../../modules/admin/admin-payments.service";
import {
  AdminPaymentManagement,
  type AdminPaymentListItem
} from "../../../modules/admin/components/admin-payment-management";

type AdminPaymentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
  const params = await searchParams;
  const search = singleValue(params.search).trim();
  const activeStatus = parseStatusFilter(singleValue(params.status));
  const activeGateway = parseGatewayFilter(singleValue(params.gateway));
  const dateRange = singleValue(params.dateRange).trim();
  const [metrics, revenueSummary, charts, payments] = await Promise.all([
    getAdminPaymentMetrics(),
    getAdminPaymentRevenueSummary(),
    getAdminPaymentChartData(),
    getAdminPayments({
      dateRange,
      gateway: activeGateway,
      search,
      status: activeStatus
    })
  ]);

  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Review platform payment events, invoices, and payout status." title="Payments" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard icon={<WalletCards className="h-4 w-4" />} label="Total Revenue" value={`BDT ${formatMoney(metrics.totalRevenue)}`} />
        <AdminMetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Successful Payments" value={metrics.successfulPayments.toString()} tone="green" />
        <AdminMetricCard icon={<Clock3 className="h-4 w-4" />} label="Pending Payments" value={metrics.pendingPayments.toString()} tone="blue" />
        <AdminMetricCard icon={<AlertCircle className="h-4 w-4" />} label="Failed Payments" value={metrics.failedPayments.toString()} tone="amber" />
      </div>
      <AdminPaymentManagement
        activeGateway={activeGateway}
        activeStatus={activeStatus}
        charts={{
          gatewayDistribution: charts.gatewayDistribution,
          revenueByMonth: charts.revenueByMonth,
          statusDistribution: charts.statusDistribution
        }}
        dateRange={dateRange}
        payments={payments.map(toPaymentListItem)}
        revenueSummary={revenueSummary}
        search={search}
      />
    </section>
  );
}

type AdminPaymentRecord = Awaited<ReturnType<typeof getAdminPayments>>[number];

function toPaymentListItem(payment: AdminPaymentRecord): AdminPaymentListItem {
  const owner =
    payment.organization.members.find((member) => member.role === "OWNER") ??
    payment.organization.members[0];
  const timeline = [
    {
      label: "Payment Created",
      value: formatDateTime(payment.createdAt)
    },
    {
      label: payment.status === "PAID" ? "Payment Paid" : "Current Status",
      value: payment.status === "PAID" ? formatDateTime(payment.paidAt) : titleCase(payment.status)
    },
    {
      label: "Last Updated",
      value: formatDateTime(payment.updatedAt)
    }
  ];

  return {
    amount: payment.amount.toString(),
    createdAt: formatDate(payment.createdAt),
    currency: payment.currency,
    gateway: payment.gateway,
    id: payment.id,
    invoiceNumber: payment.invoiceNumber,
    ownerEmail: owner?.user.email ?? "No owner email",
    ownerName: owner?.user.name ?? "No owner assigned",
    paidAt: formatDate(payment.paidAt),
    paymentMethod: payment.paymentMethod,
    paymentNote: payment.paymentNote ?? "Not set",
    paymentReference: payment.paymentReference ?? "No reference",
    planName: payment.subscription.plan.name,
    rejectionReason: payment.rejectionReason ?? "Not set",
    senderNumber: payment.senderNumber ?? "Not set",
    status: payment.status,
    storeDomain: payment.store.domains[0]?.domain ?? `${payment.store.slug}.dash.com`,
    storeName: payment.store.name,
    subscriptionStatus: payment.subscription.status,
    timeline
  };
}

function parseStatusFilter(value: string): AdminPaymentStatusFilter {
  const filters: AdminPaymentStatusFilter[] = ["all", "cancelled", "failed", "paid", "pending", "refunded"];
  return filters.includes(value as AdminPaymentStatusFilter) ? value as AdminPaymentStatusFilter : "all";
}

function parseGatewayFilter(value: string): AdminPaymentGatewayFilter {
  const filters: AdminPaymentGatewayFilter[] = ["all", "manual", "other", "paddle", "sslcommerz", "stripe"];
  return filters.includes(value as AdminPaymentGatewayFilter) ? value as AdminPaymentGatewayFilter : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(date);
}

function formatDateTime(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatMoney(value: string) {
  return Number(value).toLocaleString("en", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
