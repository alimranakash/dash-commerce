import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { AbandonedCartsReportDashboard, CustomersReportDashboard, IncompleteOrdersReportDashboard, OrdersReportDashboard, ProductsReportDashboard, RevenuesReportDashboard } from "../../../../modules/reports/components/report-section-dashboards";
import { DateRangeFilter } from "../../../../modules/reports/components/report-section-components";
import { getAbandonedCartsReport, getCustomersReport, getIncompleteOrdersReport, getOrdersReport, getProductsReport, getRevenuesReport } from "../../../../modules/reports/report.service";
import { parseReportRange, type ReportRangeKey } from "../../../../modules/reports/report.types";
import { requireStore } from "../../../../modules/stores/queries";

const reportTitles: Record<string, string> = {
  "abandoned-carts": "Abandoned Carts",
  customers: "Customers",
  "incomplete-orders": "Incomplete Orders",
  orders: "Orders",
  products: "Products",
  revenues: "Revenues"
};

type ReportSectionPageProps = {
  params: Promise<{ report: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportSectionPage({ params, searchParams }: ReportSectionPageProps) {
  const store = await requireStore();
  const { report } = await params;
  const title = reportTitles[report];

  if (!title) notFound();
  const range = parseReportRange((await searchParams).range);
  const dashboard = await loadReportDashboard(report, store.id, store.currency, range);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="mx-auto grid max-w-[1480px] gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="m-0 text-[1.65rem] font-semibold leading-tight">{title} Report</h1><p className="mt-1.5 text-xs text-[#777985]">Store-scoped {title.toLowerCase()} performance and activity.</p></div><DateRangeFilter basePath={`/dashboard/reports/${report}`} range={range} /></div>
        {dashboard}
      </section>
    </DashboardShell>
  );
}

async function loadReportDashboard(report: string, storeId: string, currency: string, range: ReportRangeKey) {
  if (report === "abandoned-carts") return <AbandonedCartsReportDashboard data={await getAbandonedCartsReport(storeId, currency, range)} />;
  if (report === "incomplete-orders") return <IncompleteOrdersReportDashboard data={await getIncompleteOrdersReport(storeId, currency, range)} />;
  if (report === "orders") return <OrdersReportDashboard data={await getOrdersReport(storeId, currency, range)} />;
  if (report === "revenues") return <RevenuesReportDashboard data={await getRevenuesReport(storeId, currency, range)} />;
  if (report === "products") return <ProductsReportDashboard data={await getProductsReport(storeId, currency, range)} />;
  if (report === "customers") return <CustomersReportDashboard data={await getCustomersReport(storeId, currency, range)} />;
  notFound();
}
