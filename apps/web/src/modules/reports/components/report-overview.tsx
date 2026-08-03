import {
  BadgeDollarSign,
  Box,
  CalendarDays,
  CircleDollarSign,
  Ellipsis,
  PackageCheck,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Users
} from "lucide-react";
import type { ComponentType } from "react";
import type { ReportMetric, ReportOverviewData } from "../report.types";
import { ReportCard } from "./report-card";
import { ReportLineChart } from "./report-line-chart";

const subscriptionRows: Array<{ icon: ComponentType<{ className?: string }>; label: string }> = [
  { icon: RefreshCcw, label: "Current Subscriptions" },
  { icon: CalendarDays, label: "Subscriptions ending this month" },
  { icon: CircleDollarSign, label: "MRR amount" },
  { icon: BadgeDollarSign, label: "Project MRR" }
];

export function ReportOverview({ data }: { data: ReportOverviewData }) {
  const labels = data.daily.map((point) => point.label);
  const metrics: Array<{ icon: ComponentType<{ className?: string }>; label: string; metric: ReportMetric; money?: boolean }> = [
    { icon: ReceiptText, label: "Orders", metric: data.orders },
    { icon: BadgeDollarSign, label: "Sales", metric: data.sales, money: true },
    { icon: RotateCcw, label: "Refunds", metric: data.refunds, money: true },
    { icon: CircleDollarSign, label: "Net Revenue", metric: data.netRevenue, money: true },
    { icon: PackageCheck, label: "Products Sold", metric: data.productsSold },
    { icon: Users, label: "Customers", metric: data.customers }
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => <ReportMetricCard currency={data.currency} key={item.label} {...item} />)}
      </div>

      <ReportCard title="Sales vs. Refunds vs. Net Revenue">
        <ReportLineChart
          labels={labels}
          series={[
            { color: "#19a87b", label: "Sales", values: data.daily.map((point) => point.sales) },
            { color: "#f47b62", label: "Refunds", values: data.daily.map((point) => point.refunds) },
            { color: "#397ee8", label: "Net Revenue", values: data.daily.map((point) => point.netRevenue) }
          ]}
        />
      </ReportCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReportCard title="Order vs. Refund Count">
          <ReportLineChart
            labels={labels}
            series={[
              { color: "#ef4444", label: "Order Count", values: data.daily.map((point) => point.orderCount) },
              { color: "#f58a5b", label: "Refund Count", values: data.daily.map((point) => point.refundCount) }
            ]}
          />
        </ReportCard>
        <ReportCard title="Order Statuses">
          <div className="grid min-h-64 content-center gap-4 p-5">
            {data.orderStatuses.map((status, index) => (
              <div className="grid grid-cols-[90px_1fr_32px] items-center gap-3 text-xs" key={status.label}>
                <span>{status.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[#f0eff6]"><span className="block h-full rounded-full" style={{ backgroundColor: statusColors[index], width: `${statusWidth(status.count, data.orders.value)}%` }} /></span>
                <strong className="text-right">{status.count}</strong>
              </div>
            ))}
          </div>
        </ReportCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReportCard title="Subscriptions">
          <div className="divide-y divide-[#f0eff5] px-5">
            {subscriptionRows.map(({ icon: Icon, label }) => (
              <div className="flex items-center justify-between py-5" key={label}>
                <span className="flex items-center gap-3 text-xs"><span className="grid h-8 w-8 place-items-center rounded-md bg-[#f4f1ff] text-[#7650e8]"><Icon className="h-4 w-4" /></span>{label}</span>
                <strong className="text-sm">0</strong>
              </div>
            ))}
          </div>
        </ReportCard>
        <ReportCard title="Order Type">
          <ReportLineChart
            labels={labels}
            series={[
              { color: "#6847dd", label: "New Orders", values: data.daily.map((point) => point.orderCount) },
              { color: "#aa8af8", label: "Renewal Orders", values: data.daily.map(() => 0) }
            ]}
          />
        </ReportCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReportCard title="Top Selling Items">
          {data.topProducts.length ? (
            <div className="overflow-x-auto p-4">
              <table className="w-full text-left text-xs"><thead className="bg-[#f7f7fa] text-[#656773]"><tr><th className="p-3">Product</th><th className="p-3">Sold</th><th className="p-3 text-right">Revenue</th></tr></thead><tbody>{data.topProducts.map((product) => <tr className="border-b border-[#f0eff5]" key={product.title}><td className="p-3 font-medium">{product.title}</td><td className="p-3">{formatNumber(product.quantity)}</td><td className="p-3 text-right">{formatMoney(product.revenue, data.currency)}</td></tr>)}</tbody></table>
            </div>
          ) : <ReportEmptyState message="No data available for the selected range." />}
        </ReportCard>
        <ReportCard title="Product Stats">
          <div className="divide-y divide-[#f0eff5] px-5">
            <StatRow icon={Box} label="Products in Catalog" value={formatNumber(data.productStats.productsInCatalog)} />
            <StatRow icon={PackageCheck} label="Variations across products" value={formatNumber(data.productStats.variations)} />
            <StatRow icon={CircleDollarSign} label="Average product price" value={formatMoney(data.productStats.averagePrice, data.currency)} />
            <StatRow icon={PackageCheck} label="Inventory count" value={formatNumber(data.productStats.inventoryCount)} />
          </div>
        </ReportCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReportCard title="New vs. Returning Customers">
          <ReportLineChart
            labels={labels}
            series={[
              { color: "#2789e8", label: "New", values: data.daily.map((point) => point.newCustomerOrders) },
              { color: "#994fe8", label: "Returning", values: data.daily.map((point) => point.returningCustomerOrders) }
            ]}
          />
        </ReportCard>
        <ReportCard title="Customer Overview">
          <div className="grid min-h-72 md:grid-cols-[190px_1fr]">
            <div className="divide-y divide-[#f0eff5] border-r border-[#f0eff5] p-4">
              <CustomerMetric label="AOV Per Customer" value={formatMoney(data.customerOverview.aov, data.currency)} />
              <CustomerMetric label="Orders Per Customer" value={data.customerOverview.ordersPerCustomer.toFixed(1)} />
              <CustomerMetric label="Items Per Customer" value={data.customerOverview.itemsPerCustomer.toFixed(1)} />
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full text-left text-[11px]"><thead className="bg-[#f7f7fa]"><tr><th className="p-3">Name</th><th className="p-3">Orders</th><th className="p-3 text-right">Purchased</th></tr></thead><tbody>{data.customerOverview.topCustomers.map((customer) => <tr className="border-b border-[#f0eff5]" key={customer.name}><td className="p-3">{customer.name}</td><td className="p-3">{customer.orders}</td><td className="p-3 text-right">{formatMoney(customer.purchased, data.currency)}</td></tr>)}</tbody></table>
              {!data.customerOverview.topCustomers.length ? <p className="py-12 text-center text-xs text-[#8b8c97]">No customer activity in this period.</p> : null}
            </div>
          </div>
        </ReportCard>
      </div>
    </div>
  );
}

function ReportMetricCard({ currency, icon: Icon, label, metric, money }: { currency: string; icon: ComponentType<{ className?: string }>; label: string; metric: ReportMetric; money?: boolean }) {
  const positive = metric.change >= 0;
  return (
    <article className="rounded-lg border border-[#ececf5] bg-white p-4 shadow-[0_6px_18px_rgba(62,54,114,0.035)]">
      <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold"><span className="grid h-8 w-8 place-items-center rounded-md bg-[#f4f1ff] text-[#7650e8]"><Icon className="h-4 w-4" /></span>{label}</span><Ellipsis className="h-4 w-4 text-[#777985]" /></div>
      <div className="mt-5 flex items-end justify-between gap-3"><strong className="text-lg">{money ? formatMoney(metric.value, currency) : formatNumber(metric.value)}</strong><span className={`text-[9px] ${positive ? "text-emerald-600" : "text-rose-500"}`}>{positive ? "↗" : "↘"} {Math.abs(metric.change).toFixed(0)}% <span className="text-[#999aa4]">vs prev. period</span></span></div>
    </article>
  );
}

function StatRow({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 py-5"><span className="flex items-center gap-3 text-xs"><span className="grid h-8 w-8 place-items-center rounded-md bg-[#f4f1ff] text-[#7650e8]"><Icon className="h-4 w-4" /></span>{label}</span><strong className="text-xs">{value}</strong></div>;
}

function CustomerMetric({ label, value }: { label: string; value: string }) {
  return <div className="py-4"><span className="text-[10px] text-[#777985]">{label}</span><strong className="mt-1 block text-base">{value}</strong></div>;
}

function ReportEmptyState({ message }: { message: string }) {
  return <div className="grid min-h-64 place-items-center p-6 text-center text-xs text-[#858691]">{message}</div>;
}

const statusColors = ["#f2b84b", "#7c66ef", "#3b82f6", "#20a66a", "#ef5b6a"];

function statusWidth(value: number, total: number) {
  return total ? Math.max(3, value / total * 100) : 0;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}
