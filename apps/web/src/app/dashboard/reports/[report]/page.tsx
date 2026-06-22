import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { AbandonedCartsReportDashboard, CustomersReportDashboard, OrdersReportDashboard, ProductsReportDashboard, RevenuesReportDashboard } from "../../../../modules/reports/components/report-section-dashboards";
import { DateRangeFilter } from "../../../../modules/reports/components/report-section-components";
import { getAbandonedCartsReport, getCustomersReport, getOrdersReport, getProductsReport, getRevenuesReport } from "../../../../modules/reports/report.service";
import { requireStore } from "../../../../modules/stores/queries";

const reportTitles: Record<string, string> = {
  "abandoned-carts": "Abandoned Carts",
  customers: "Customers",
  orders: "Orders",
  products: "Products",
  revenues: "Revenues"
};

export default async function ReportSectionPage({ params }: { params: Promise<{ report: string }> }) {
  const store = await requireStore();
  const { report } = await params;
  const title = reportTitles[report];

  if (!title) notFound();
  const dashboard = await loadReportDashboard(report, store.id, store.currency);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="mx-auto grid max-w-[1480px] gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="m-0 text-[1.65rem] font-semibold leading-tight">{title} Report</h1><p className="mt-1.5 text-xs text-[#777985]">Store-scoped {title.toLowerCase()} performance and activity.</p></div><DateRangeFilter /></div>
        {dashboard}
      </section>
    </DashboardShell>
  );
}

async function loadReportDashboard(report: string, storeId: string, currency: string) {
  if (report === "abandoned-carts") return <AbandonedCartsReportDashboard data={await getAbandonedCartsReport(storeId, currency)} />;
  if (report === "orders") return <OrdersReportDashboard data={await getOrdersReport(storeId, currency)} />;
  if (report === "revenues") return <RevenuesReportDashboard data={await getRevenuesReport(storeId, currency)} />;
  if (report === "products") return <ProductsReportDashboard data={await getProductsReport(storeId, currency)} />;
  if (report === "customers") return <CustomersReportDashboard data={await getCustomersReport(storeId, currency)} />;
  notFound();
}
