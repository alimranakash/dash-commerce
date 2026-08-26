import { BadgeDollarSign, Ban, Box, CheckCircle2, CircleAlert, CircleDollarSign, ClipboardList, Clock3, PackageCheck, PackageOpen, Percent, ReceiptText, RefreshCcw, ShoppingBag, ShoppingCart, TrendingDown, TrendingUp, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import type { AbandonedCartsReportData, CustomersReportData, IncompleteOrdersReportData, MerchandisingReportData, OrdersReportData, ProductsReportData, RevenuesReportData } from "../report.types";
import { ReportCard } from "./report-card";
import { ReportLineChart } from "./report-line-chart";
import { ReportBarList, ReportEmptyState, ReportMetricCard, ReportTable, formatMoney, formatNumber } from "./report-section-components";

export function AbandonedCartsReportDashboard({ data }: { data: AbandonedCartsReportData }) {
  const hasCartActivity = data.metrics.total > 0;
  const hasRecoveryActivity = data.metrics.recoveredRevenue > 0;

  return <div className="grid gap-4">
    <MetricGrid metrics={[
      { icon: ShoppingCart, label: "Total Abandoned Carts", value: formatNumber(data.metrics.total) },
      { icon: Percent, label: "Recovery Rate", value: `${data.metrics.recoveryRate.toFixed(1)}%` },
      { icon: CircleDollarSign, label: "Recovered Revenue", value: formatMoney(data.metrics.recoveredRevenue, data.currency) },
      { icon: TrendingDown, label: "Lost Revenue", value: formatMoney(data.metrics.lostRevenue, data.currency) }
    ]} />
    <ReportCard title="Recovery Analytics"><ReportChartOrEmpty data={data} mode="revenue" show={hasCartActivity} /></ReportCard>
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportCard title="Abandoned Cart Trends"><ReportChartOrEmpty data={data} mode="carts" show={hasCartActivity} /></ReportCard>
      <ReportCard title="Recovery Trends"><ReportChartOrEmpty data={data} mode="recovery" show={hasCartActivity} /></ReportCard>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportCard title="Recovered Revenue & Lost Revenue Trends"><ReportChartOrEmpty data={data} mode="revenue" show={hasCartActivity} /></ReportCard>
      <ReportCard title="Recovery Performance"><ReportChartOrEmpty data={data} mode="performance" show={hasRecoveryActivity} /></ReportCard>
    </div>
    <ReportCard title="Top Recovery Channels">
      {data.recoveryChannels.length ? <ReportBarList items={data.recoveryChannels} /> : <ReportEmptyState message="Recovery channels appear here once a contacted cart is recovered." />}
    </ReportCard>
  </div>;
}

export function IncompleteOrdersReportDashboard({ data }: { data: IncompleteOrdersReportData }) {
  const hasActivity = data.metrics.total > 0;
  const labels = data.daily.map((point) => point.label);

  return <div className="grid gap-4">
    <MetricGrid metrics={[
      { icon: ClipboardList, label: "Incomplete Orders", value: formatNumber(data.metrics.total) },
      { icon: CircleAlert, label: "Failed at Checkout", value: formatNumber(data.metrics.failed) },
      { icon: Percent, label: "Recovery Rate", value: `${data.metrics.recoveryRate.toFixed(1)}%` },
      { icon: CircleDollarSign, label: "Recovered Revenue", value: formatMoney(data.metrics.recoveredRevenue, data.currency) },
      { icon: TrendingDown, label: "Lost Revenue", value: formatMoney(data.metrics.lostRevenue, data.currency) }
    ]} />
    {/*
      First card on the page, because it is the only one that names something
      the seller can go and change. Everything below it is the size of the
      problem; this is the cause.
    */}
    <ReportCard title="Why Checkouts Failed">
      {data.failureReasons.length ? <ReportBarList items={data.failureReasons} /> : <ReportEmptyState message="No checkout was refused in this period. Everything here was left unfinished by the shopper." />}
    </ReportCard>
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportCard title="Incomplete Order Trends">{hasActivity ? <ReportLineChart labels={labels} series={[
        { color: "#7650e8", label: "Incomplete Orders", values: data.daily.map((point) => point.incomplete) },
        { color: "#ef6f61", label: "Failed at Checkout", values: data.daily.map((point) => point.failed) },
        { color: "#20a66a", label: "Recovered", values: data.daily.map((point) => point.recovered) }
      ]} /> : <IncompleteEmpty />}</ReportCard>
      <ReportCard title="Recovery Performance">{hasActivity ? <ReportLineChart labels={labels} series={[
        { color: "#2789e8", label: "Recovery Rate", values: data.daily.map((point) => point.recoveryRate) }
      ]} /> : <IncompleteEmpty />}</ReportCard>
    </div>
    <ReportCard title="Recovered Revenue & Lost Revenue Trends">{hasActivity ? <ReportLineChart labels={labels} series={[
      { color: "#20a66a", label: "Recovered Revenue", values: data.daily.map((point) => point.recoveredRevenue) },
      { color: "#ef6f61", label: "Lost Revenue", values: data.daily.map((point) => point.lostRevenue) }
    ]} /> : <IncompleteEmpty />}</ReportCard>
    <ReportCard title="Top Recovery Channels">
      {data.recoveryChannels.length ? <ReportBarList items={data.recoveryChannels} /> : <ReportEmptyState message="Recovery channels appear here once a contacted checkout turns into an order." />}
    </ReportCard>
  </div>;
}

function IncompleteEmpty() { return <ReportEmptyState message="No incomplete checkout activity is available for this reporting period." />; }

export function OrdersReportDashboard({ data }: { data: OrdersReportData }) {
  const metrics = [
    [ReceiptText, "Total Orders", data.metrics.total], [Clock3, "Pending Orders", data.metrics.pending], [RefreshCcw, "Processing Orders", data.metrics.processing],
    [CheckCircle2, "Completed Orders", data.metrics.completed], [Ban, "Cancelled Orders", data.metrics.cancelled], [CircleDollarSign, "Refunded Orders", data.metrics.refunded]
  ] as const;
  return <div className="grid gap-4"><MetricGrid metrics={metrics.map(([icon, label, value]) => ({ icon, label, value: formatNumber(value) }))} />
    <ReportCard title="Orders Trend Chart"><SingleSeriesChart color="#7650e8" data={data.daily} label="Orders" /></ReportCard>
    <div className="grid gap-4 xl:grid-cols-2"><ReportCard title="Orders by Status"><ReportBarList items={data.statuses} /></ReportCard><ReportCard title="Monthly Orders"><SingleSeriesChart color="#2789e8" data={data.monthly} label="Monthly Orders" /></ReportCard></div>
    <div className="grid gap-4 xl:grid-cols-2"><ReportCard title="Daily Orders"><SingleSeriesChart color="#20a66a" data={data.daily.slice(-14)} label="Daily Orders" /></ReportCard><ReportCard title="Recent Orders Table"><ReportTable emptyMessage="No recent orders in this period." headers={["Order", "Customer", "Status", "Total", "Date"]} rows={data.recentOrders.map((order) => [<Link className="font-medium text-[#6d3cf5] hover:underline" href={`/dashboard/orders/${order.id}`}>{order.orderNumber}</Link>, order.customer, titleCase(order.status), formatMoney(order.total, data.currency), formatDate(order.createdAt)])} /></ReportCard></div>
  </div>;
}

export function RevenuesReportDashboard({ data }: { data: RevenuesReportData }) {
  return <div className="grid gap-4"><MetricGrid metrics={[
    { icon: BadgeDollarSign, label: "Gross Revenue", value: formatMoney(data.metrics.gross, data.currency) }, { icon: CircleDollarSign, label: "Net Revenue", value: formatMoney(data.metrics.net, data.currency) },
    { icon: RefreshCcw, label: "Refund Amount", value: formatMoney(data.metrics.refunds, data.currency) }, { icon: TrendingUp, label: "Average Order Value", value: formatMoney(data.metrics.aov, data.currency) }
  ]} />
    <ReportCard title="Revenue Trend Chart"><DualSeriesChart data={data.daily} first="Revenue" second="Refunds" /></ReportCard>
    <div className="grid gap-4 xl:grid-cols-2"><ReportCard title="Revenue by Month"><DualSeriesChart data={data.monthly} first="Revenue" second="Refunds" /></ReportCard><ReportCard title="Revenue vs Refunds"><DualSeriesChart data={data.daily.slice(-14)} first="Revenue" second="Refunds" /></ReportCard></div>
    <ReportCard title="Top Revenue Days"><ReportTable emptyMessage="No revenue activity in this period." headers={["Date", "Orders", "Revenue"]} rows={data.topDays.filter((day) => day.revenue > 0).map((day) => [day.date, formatNumber(day.orders), formatMoney(day.revenue, data.currency)])} /></ReportCard>
  </div>;
}

export function ProductsReportDashboard({ data }: { data: ProductsReportData }) {
  return <div className="grid gap-4"><MetricGrid metrics={[
    { icon: Box, label: "Products in Catalog", value: formatNumber(data.metrics.total) }, { icon: PackageCheck, label: "Active Products", value: formatNumber(data.metrics.active) },
    { icon: PackageOpen, label: "Low Stock Products", value: formatNumber(data.metrics.lowStock) }, { icon: Ban, label: "Out of Stock Products", value: formatNumber(data.metrics.outOfStock) }
  ]} />
    <div className="grid gap-4 xl:grid-cols-2"><ReportCard title="Top Selling Products"><ProductTable data={data} /></ReportCard><ReportCard title="Inventory Summary"><ReportBarList items={data.inventory} /></ReportCard></div>
    <div className="grid gap-4 xl:grid-cols-2"><ReportCard title="Product Performance"><ReportTable emptyMessage="No product sales data available." headers={["Product", "Units Sold", "Revenue"]} rows={data.topProducts.map((product) => [product.title, formatNumber(product.quantity), formatMoney(product.revenue, data.currency)])} /></ReportCard><ReportCard title="Category Performance"><ReportTable emptyMessage="No category sales data available." headers={["Category", "Units Sold", "Revenue"]} rows={data.categoryPerformance.map((category) => [category.category, formatNumber(category.quantity), formatMoney(category.revenue, data.currency)])} /></ReportCard></div>
    <ReportCard title="Low Stock Table"><ReportTable emptyMessage="No low-stock products. Inventory looks healthy." headers={["Product", "Current Stock", "Low Stock Threshold"]} rows={data.lowStock.map((product) => [<Link className="font-medium text-[#6d3cf5] hover:underline" href={`/dashboard/products/${product.id}/edit`}>{product.title}</Link>, formatNumber(product.stock), formatNumber(product.threshold)])} /></ReportCard>
  </div>;
}

export function CustomersReportDashboard({ data }: { data: CustomersReportData }) {
  return <div className="grid gap-4"><MetricGrid metrics={[
    { icon: Users, label: "Total Customers", value: formatNumber(data.metrics.total) }, { icon: UserPlus, label: "New Customers", value: formatNumber(data.metrics.newCustomers) },
    { icon: RefreshCcw, label: "Returning Customers", value: formatNumber(data.metrics.returning) }, { icon: ShoppingBag, label: "Average Customer Value", value: formatMoney(data.metrics.averageValue, data.currency) }
  ]} />
    <ReportCard title="Customer Growth Chart"><SingleSeriesChart color="#2789e8" data={data.growth} label="New Customers" /></ReportCard>
    <div className="grid gap-4 xl:grid-cols-2"><ReportCard title="New vs Returning Customers"><ReportBarList items={[{ label: "New", value: data.metrics.newCustomers }, { label: "Returning", value: data.metrics.returning }]} /></ReportCard><ReportCard title="Customer Purchase Frequency"><ReportBarList items={data.frequency} /></ReportCard></div>
    <ReportCard title="Top Customers Table"><ReportTable emptyMessage="No customer purchases are available yet." headers={["Customer", "Orders", "Purchased"]} rows={data.topCustomers.map((customer) => [customer.name, formatNumber(customer.orders), formatMoney(customer.purchased, data.currency)])} /></ReportCard>
  </div>;
}


export function MerchandisingReportDashboard({ data }: { data: MerchandisingReportData }) {
  const hasSuggestedSales = data.metrics.suggestedRevenue > 0;
  // The figure the seller is really after: how much of what the store took came
  // from something it suggested rather than something the shopper came for.
  const shareOfRevenue = data.totalRevenue ? (data.metrics.suggestedRevenue / data.totalRevenue) * 100 : 0;

  return <div className="grid gap-4">
    <MetricGrid metrics={[
      { icon: CircleDollarSign, label: "Revenue From Suggestions", value: formatMoney(data.metrics.suggestedRevenue, data.currency) },
      { icon: Percent, label: "Share Of All Revenue", value: `${shareOfRevenue.toFixed(1)}%` },
      { icon: Percent, label: "Orders That Took One", value: `${data.metrics.attachRate.toFixed(1)}%` },
      { icon: BadgeDollarSign, label: "Order Bump Revenue", value: formatMoney(data.metrics.orderBumpRevenue, data.currency) },
      { icon: ShoppingCart, label: "Cart Suggestion Revenue", value: formatMoney(data.metrics.crossSellRevenue, data.currency) },
      { icon: Box, label: "Units Sold This Way", value: formatNumber(data.metrics.orderBumpUnits + data.metrics.crossSellUnits) },
      { icon: PackageOpen, label: "Orders That Hit A Bundle", value: formatNumber(data.metrics.bundleOrders) },
      { icon: TrendingDown, label: "Given Away In Bundles", value: formatMoney(data.metrics.bundleSavings, data.currency) }
    ]} />
    <ReportCard title="Revenue By Surface">
      {hasSuggestedSales ? <ReportLineChart labels={data.daily.map((point) => point.label)} series={[
        { color: "#e0a020", label: "Order Bump", values: data.daily.map((point) => point.orderBump) },
        { color: "#7650e8", label: "Cart Suggestion", values: data.daily.map((point) => point.crossSell) }
      ]} /> : <ReportEmptyState message="Nothing has sold through a suggestion in this period yet. Pair a few products, or turn the order bump on." />}
    </ReportCard>
    <ReportCard title="Bundles">
      <ReportTable
        emptyMessage="Bundles appear here once a cart qualifies for one."
        headers={["Bundle", "Times Applied", "Given Away"]}
        rows={data.topBundles.map((entry) => [entry.name, formatNumber(entry.timesApplied), formatMoney(entry.savings, data.currency)])}
      />
    </ReportCard>
    <ReportCard title="What Sold Through A Suggestion">
      <ReportTable
        emptyMessage="Products appear here once a shopper takes one of your suggestions."
        headers={["Product", "Surface", "Units", "Revenue"]}
        rows={data.topSuggested.map((entry) => [entry.title, entry.source, formatNumber(entry.quantity), formatMoney(entry.revenue, data.currency)])}
      />
    </ReportCard>
  </div>;
}

function MetricGrid({ metrics }: { metrics: Array<{ icon: typeof ReceiptText; label: string; value: string }> }) { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <ReportMetricCard key={metric.label} {...metric} />)}</div>; }
function ReportChartOrEmpty({ data, mode, show }: { data: AbandonedCartsReportData; mode: "carts" | "performance" | "recovery" | "revenue"; show: boolean }) {
  if (!show) return <ReportEmptyState message="No abandoned cart activity is available for this reporting period." />;

  const labels = data.daily.map((point) => point.label);
  if (mode === "carts") return <ReportLineChart labels={labels} series={[
    { color: "#7650e8", label: "Abandoned Carts", values: data.daily.map((point) => point.abandoned) },
    { color: "#20a66a", label: "Recovered Carts", values: data.daily.map((point) => point.recovered) }
  ]} />;
  if (mode === "recovery") return <ReportLineChart labels={labels} series={[
    { color: "#20a66a", label: "Recovered Carts", values: data.daily.map((point) => point.recovered) }
  ]} />;
  if (mode === "performance") return <ReportLineChart labels={labels} series={[
    { color: "#2789e8", label: "Recovery Rate", values: data.daily.map((point) => point.recoveryRate) }
  ]} />;
  return <ReportLineChart labels={labels} series={[
    { color: "#20a66a", label: "Recovered Revenue", values: data.daily.map((point) => point.recoveredRevenue) },
    { color: "#ef6f61", label: "Lost Revenue", values: data.daily.map((point) => point.lostRevenue) }
  ]} />;
}
function SingleSeriesChart({ color, data, label }: { color: string; data: Array<{ label: string; value: number }>; label: string }) { return <ReportLineChart labels={data.map((point) => point.label)} series={[{ color, label, values: data.map((point) => point.value) }]} />; }
function DualSeriesChart({ data, first, second }: { data: Array<{ label: string; secondary?: number; value: number }>; first: string; second: string }) { return <ReportLineChart labels={data.map((point) => point.label)} series={[{ color: "#20a66a", label: first, values: data.map((point) => point.value) }, { color: "#ef6f61", label: second, values: data.map((point) => point.secondary ?? 0) }]} />; }
function ProductTable({ data }: { data: ProductsReportData }) { return <ReportTable emptyMessage="No product sales data available." headers={["Product", "Sold", "Revenue"]} rows={data.topProducts.map((product) => [product.title, formatNumber(product.quantity), formatMoney(product.revenue, data.currency)])} />; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value); }
function titleCase(value: string) { return value.charAt(0) + value.slice(1).toLowerCase(); }
