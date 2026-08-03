import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { ReportOverview } from "../../../modules/reports/components/report-overview";
import { DateRangeFilter } from "../../../modules/reports/components/report-section-components";
import { getReportOverview } from "../../../modules/reports/report.service";
import { parseReportRange } from "../../../modules/reports/report.types";
import { requireStore } from "../../../modules/stores/queries";

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const store = await requireStore();
  const range = parseReportRange((await searchParams).range);
  const report = await getReportOverview(store.id, store.currency, range);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="mx-auto grid max-w-[1480px] gap-4" aria-label="Reports overview">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Overview</h1>
          <DateRangeFilter basePath="/dashboard/reports" comparison range={range} />
        </div>
        <ReportOverview data={report} />
      </section>
    </DashboardShell>
  );
}
