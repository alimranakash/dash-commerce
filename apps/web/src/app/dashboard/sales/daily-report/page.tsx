import { Suspense } from "react";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import {
  DailySalesReportError,
  DailySalesReportHeader,
  DailySalesReportSection,
  DailySalesReportSkeleton
} from "../../../../modules/sales/components/daily-sales-report";
import {
  dailyReportClock,
  dailyReportHref,
  parseReportDay,
  parseReportPage
} from "../../../../modules/sales/sale-daily-report";
import { requireStore } from "../../../../modules/stores/queries";

type DailySalesReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * One business day of counter sales. Guarded as the sales list is — the store
 * is the session's, and every figure is read within it — and, like the list,
 * open to any team member: it shows nothing the list does not.
 */
export default async function DailySalesReportPage({ searchParams }: DailySalesReportPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const now = new Date();
  const { timeZone, today } = dailyReportClock(store.timezone, now);
  const asked = Array.isArray(params.date) ? params.date[0] : params.date;
  const day = asked ? parseReportDay(asked) : today;
  const page = parseReportPage(params.page);
  const all = params.all === "1";

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="mx-auto grid max-w-[1480px] gap-4">
        <DailySalesReportHeader day={day ?? today} timeZone={timeZone} today={today} />
        {day ? (
          // Keyed by what was asked for, so a new day or page shows the
          // skeleton instead of the last day's figures under the new date.
          <Suspense
            fallback={<DailySalesReportSkeleton />}
            key={`${day}:${page}:${all ? "all" : ""}`}
          >
            <DailySalesReportSection
              clock={{ now, timeZone, today }}
              request={{ all, day, page }}
              store={{
                currency: store.currency,
                id: store.id,
                name: store.name,
                organizationId: store.organizationId
              }}
            />
          </Suspense>
        ) : (
          <DailySalesReportError
            href={dailyReportHref(today)}
            linkLabel="Show today"
            message="Pick a date with the calendar above, or open today's report."
            title="That isn't a valid date"
          />
        )}
      </section>
    </DashboardShell>
  );
}
