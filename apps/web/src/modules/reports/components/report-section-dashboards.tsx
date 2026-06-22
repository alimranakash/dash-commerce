import { BadgeDollarSign, Ban, Box, CheckCircle2, CircleDollarSign, Clock3, PackageCheck, PackageOpen, ReceiptText, RefreshCcw, ShoppingBag, TrendingUp, UserPlus, Users } from "lucide-react";
import type { CustomersReportData, OrdersReportData, ProductsReportData, RevenuesReportData } from "../report.types";
import { ReportCard } from "./report-card";
import { ReportLineChart } from "./report-line-chart";
import { ReportBarList, ReportMetricCard, ReportTable, formatMoney, formatNumber } from "./report-section-components";

export function OrdersReportDashboard({ data }: { data: OrdersReportData }) {
  const metrics = [
    [ReceiptText, "Total Orders", data.metrics.total], [Clock3, "Pending Orders", data.metrics.pending], [RefreshCcw, "Processing Orders", data.metrics.processing],
    [CheckCircle2, "Completed Orders", data.metrics.completed], [Ban, "Cancelled Orders", data.metrics.cancelled], [CircleDollarSign, "Refunded Orders", data.metrics.refunded]
  ] as const;
  return <div className="grid gap-4"><MetricGrid metrics={metrics.map(([icon, label, value]) => ({ icon, label, value: formatNumber(value) }))} />
    <ReportCard title="Orders Trend Chart"><SingleSeriesChart color="#7650e8" data={data.daily} label="Orders" /></ReportCard>
    <div className="grid gap-4 xl:grid-cols-2"><ReportCard title="Orders by Status"><ReportBarList items={data.statuses} /></ReportCard><ReportCard title="Monthly Orders"><SingleSeriesChart color="#2789e8" data={data.monthly} label="Monthly Orders" /></ReportCard></div>
    <div className="grid gap-4 xl:grid-cols-2"><ReportCard title="Daily Orders"><SingleSeriesChart color="#20a66a" data={data.daily.slice(-14)} label="Daily Orders" /></ReportCard><ReportCard title="Recent Orders Table"><ReportTable emptyMessage="No recent orders in this period." headers={["Order", "Customer", "Status", "Total", "Date"]} rows={data.recentOrders.map((order) => [order.orderNumber, order.customer, titleCase(order.status), formatMoney(order.total, data.currency), formatDate(order.createdAt)])} /></ReportCard></div>
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
    <ReportCard title="Low Stock Table"><ReportTable emptyMessage="No low-stock products. Inventory looks healthy." headers={["Product", "Current Stock", "Low Stock Threshold"]} rows={data.lowStock.map((product) => [product.title, formatNumber(product.stock), formatNumber(product.threshold)])} /></ReportCard>
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

function MetricGrid({ metrics }: { metrics: Array<{ icon: typeof ReceiptText; label: string; value: string }> }) { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <ReportMetricCard key={metric.label} {...metric} />)}</div>; }
function SingleSeriesChart({ color, data, label }: { color: string; data: Array<{ label: string; value: number }>; label: string }) { return <ReportLineChart labels={data.map((point) => point.label)} series={[{ color, label, values: data.map((point) => point.value) }]} />; }
function DualSeriesChart({ data, first, second }: { data: Array<{ label: string; secondary?: number; value: number }>; first: string; second: string }) { return <ReportLineChart labels={data.map((point) => point.label)} series={[{ color: "#20a66a", label: first, values: data.map((point) => point.value) }, { color: "#ef6f61", label: second, values: data.map((point) => point.secondary ?? 0) }]} />; }
function ProductTable({ data }: { data: ProductsReportData }) { return <ReportTable emptyMessage="No product sales data available." headers={["Product", "Sold", "Revenue"]} rows={data.topProducts.map((product) => [product.title, formatNumber(product.quantity), formatMoney(product.revenue, data.currency)])} />; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value); }
function titleCase(value: string) { return value.charAt(0) + value.slice(1).toLowerCase(); }
