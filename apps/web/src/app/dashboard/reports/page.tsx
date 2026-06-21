import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { ReportOverview } from "../../../modules/reports/components/report-overview";
import { getReportOverview } from "../../../modules/reports/report.service";
import { requireStore } from "../../../modules/stores/queries";

export default async function ReportsPage() {
  const store = await requireStore();
  const report = await getReportOverview(store.id, store.currency);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="mx-auto grid max-w-[1480px] gap-4" aria-label="Reports overview">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Overview</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select aria-label="Report date range" className="h-9 rounded-md border border-[#e6e4f0] bg-white px-3 outline-none"><option>Last 30 days</option></select>
            <span className="text-[#777985]">vs.</span>
            <select aria-label="Report comparison range" className="h-9 rounded-md border border-[#e6e4f0] bg-white px-3 outline-none"><option>Prev. 30 days</option></select>
          </div>
        </div>
        <ReportOverview data={report} />
      </section>
    </DashboardShell>
  );
}
