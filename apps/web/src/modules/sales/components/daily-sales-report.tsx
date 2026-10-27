import { CalendarDays, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";
import { errorForLog } from "../../notifications/notifications.redact";
import {
  DAILY_REPORT_PATH,
  dailyReportHref,
  formatReportMoney,
  reportDayLabel,
  salesListHref,
  shiftReportDay,
  type DailySalesReport
} from "../sale-daily-report";
import { getDailySalesReport, type DailyReportStore } from "../sale-daily-report.service";
import { SaleStatusBadge } from "./sale-badges";
import { DailySalesReportPrint } from "./daily-sales-report-print";

const CARD =
  "rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]";

/** The title, the date picker and the day-to-day arrows — drawn at once, before the figures arrive. */
export function DailySalesReportHeader({
  day,
  timeZone,
  today
}: {
  day: string;
  timeZone: string;
  today: string;
}) {
  const previous = shiftReportDay(day, -1);
  const next = shiftReportDay(day, 1);

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow">Sales</p>
        <h1 className="m-0 text-2xl font-semibold text-[#20212a]">Daily Sales Report</h1>
        <p className="mt-2 text-sm text-[#777985]">
          {reportDayLabel(day)} · business day in {timeZone}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          aria-label="Previous day"
          className="secondary link-button inline-flex h-10 items-center"
          href={dailyReportHref(previous)}
          title={reportDayLabel(previous)}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Link>
        <DashboardQueryForm actionPath={DAILY_REPORT_PATH} className="flex items-center gap-2">
          <label className="sr-only" htmlFor="daily-report-date">
            Business date
          </label>
          <input
            className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none"
            defaultValue={day}
            id="daily-report-date"
            key={day}
            max={today}
            name="date"
            required
            type="date"
          />
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white"
            type="submit"
          >
            <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" /> Show
          </button>
        </DashboardQueryForm>
        {day < today ? (
          <Link
            aria-label="Next day"
            className="secondary link-button inline-flex h-10 items-center"
            href={dailyReportHref(next)}
            title={reportDayLabel(next)}
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : null}
        {day !== today ? (
          <Link
            className="secondary link-button inline-flex h-10 items-center"
            href={dailyReportHref(today)}
          >
            Today
          </Link>
        ) : null}
        <Link
          className="secondary link-button inline-flex h-10 items-center"
          href="/dashboard/sales"
        >
          Back to Sales
        </Link>
      </div>
    </div>
  );
}

/**
 * Reads the day and draws it, or says it could not. The read is the only part
 * that can fail at runtime, so it is the only part caught; the reason goes to
 * the log, never to the page.
 */
export async function DailySalesReportSection({
  clock,
  request,
  store
}: {
  clock: { now: Date; timeZone: string; today: string };
  request: { all: boolean; day: string; page: number };
  store: DailyReportStore;
}) {
  let report: DailySalesReport;

  try {
    report = await getDailySalesReport(store, request, clock);
  } catch (error) {
    console.error(`[sales] daily report failed: ${errorForLog(error)}`);

    return (
      <DailySalesReportError
        href={dailyReportHref(request.day)}
        linkLabel="Try again"
        message="Nothing was changed — this report only reads your sales. Try again in a moment."
        title="The report could not be loaded"
      />
    );
  }

  return <DailySalesReportView report={report} />;
}

export function DailySalesReportView({ report }: { report: DailySalesReport }) {
  const money = (cents: number) => formatReportMoney(cents, report.currency);
  const { cancelled, completed, drafts, methods, outstanding, returned } = report.figures;
  const empty = report.figures.transactionCount === 0;

  return (
    <>
      <section className={`${CARD} flex flex-wrap items-center justify-between gap-3`}>
        <p className="m-0 text-xs leading-5 text-[#777985]">
          Generated {report.generatedAt} · times in {report.timeZone}.
          {report.isToday ? " Today is still open: the figures grow as sales are saved." : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <DailySalesReportPrint report={report} />
        </div>
      </section>

      {report.isFuture ? (
        <Notice tone="warn">
          This date is after today in {report.timeZone}, so it has no sales yet.
        </Notice>
      ) : null}

      {empty ? (
        <section className={`${CARD} grid min-h-[220px] place-items-center text-center`}>
          <div>
            <h2 className="m-0 text-lg font-semibold text-[#20212a]">
              No sales on {report.dayLabel}
            </h2>
            <p className="mt-2 text-sm text-[#777985]">
              No completed, returned or cancelled sale is dated this day.
            </p>
            {report.isToday ? (
              <Link
                className="mt-4 inline-flex h-10 items-center rounded-lg border border-[#7c3aed] px-4 text-xs font-semibold text-[#6d3cf5]"
                href="/dashboard/sales/new"
              >
                New Sale
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnswerCard
              hint={`${completed.count} completed ${plural(completed.count, "sale")}`}
              label="Sold"
              value={money(completed.totalCents)}
            />
            <AnswerCard
              hint="Paid amounts recorded on this day's completed sales"
              label="Received"
              value={money(completed.paidCents)}
            />
            <AnswerCard
              hint={`${completed.withDueCount} ${plural(completed.withDueCount, "sale")} from this day still owe`}
              label="Still unpaid from this day"
              value={money(completed.dueCents)}
            />
            <AnswerCard
              hint={`${returned.count} ${plural(returned.count, "sale")} dated this day, now returned`}
              label="Returned"
              value={money(returned.totalCents)}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className={CARD}>
              <h2 className="m-0 text-base font-semibold text-[#20212a]">Sales</h2>
              <p className="mt-1 text-xs text-[#777985]">Completed sales dated this day.</p>
              <dl className="mt-4 grid gap-2 text-sm">
                <Line label="Gross sales" value={money(completed.grossCents)} />
                <Line label="Line discounts" value={`− ${money(completed.lineDiscountCents)}`} />
                <Line label="Sale discounts" value={`− ${money(completed.saleDiscountCents)}`} />
                <Line label="Net sales" strong value={money(completed.netCents)} />
                <Line label="Tax" value={`+ ${money(completed.taxCents)}`} />
                <Line label="Shipping" value={`+ ${money(completed.shippingCents)}`} />
                <Line
                  label={`Total billed · ${completed.count} ${plural(completed.count, "sale")}`}
                  strong
                  value={money(completed.totalCents)}
                />
                <Line label="Received" value={money(completed.paidCents)} />
                <Line label="Still due" value={money(completed.dueCents)} />
              </dl>
            </section>

            <section className={CARD}>
              <h2 className="m-0 text-base font-semibold text-[#20212a]">Payment methods</h2>
              <p className="mt-1 text-xs text-[#777985]">
                Completed sales dated this day, by the method recorded on each.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-left text-xs">
                  <thead className="bg-[#f7f7f9] text-[#34353e]">
                    <tr>
                      <th className="rounded-l-md px-3 py-2.5 font-medium">Method</th>
                      <th className="px-3 py-2.5 text-right font-medium">Sales</th>
                      <th className="px-3 py-2.5 text-right font-medium">Billed</th>
                      <th className="px-3 py-2.5 text-right font-medium">Received</th>
                      <th className="rounded-r-md px-3 py-2.5 text-right font-medium">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methods.map((row) => (
                      <tr
                        className={`border-b border-[#efeff4] ${row.count ? "text-[#34353e]" : "text-[#a2a3b0]"}`}
                        key={row.method}
                      >
                        <td className="px-3 py-2.5 font-semibold">{row.label}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{row.count}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {money(row.totalCents)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {money(row.paidCents)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {money(row.dueCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold text-[#20212a]">
                      <td className="px-3 py-2.5">Total</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{completed.count}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {money(completed.totalCents)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {money(completed.paidCents)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {money(completed.dueCents)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mb-0 mt-3 text-[11px] leading-5 text-[#777985]">
                Each sale records one method, so a payment split across two is counted under the one
                on the sale. Rocket is not a method on the sale form; Rocket payments recorded as
                Other are counted there.
              </p>
            </section>
          </div>
        </>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className={CARD}>
          <h2 className="m-0 text-base font-semibold text-[#20212a]">Money owed</h2>
          <p className="mt-1 text-xs text-[#777985]">
            Completed sales that still owe, at today&apos;s balances — not money received.
          </p>
          <dl className="mt-4 grid gap-2 text-sm">
            <Line label="From this day's sales" value={money(outstanding.thisDayCents)} />
            <Line label="From earlier days, still unpaid" value={money(outstanding.earlierCents)} />
            <Line
              label={`Total outstanding up to this date · ${outstanding.count} ${plural(outstanding.count, "sale")}`}
              strong
              value={money(outstanding.totalCents)}
            />
          </dl>
        </section>

        <section className={CARD}>
          <h2 className="m-0 text-base font-semibold text-[#20212a]">Returns and voids</h2>
          <p className="mt-1 text-xs text-[#777985]">
            Sales dated this day, now returned or cancelled. Kept out of Sold and Received above.
          </p>
          <dl className="mt-4 grid gap-2 text-sm">
            <Line
              label={
                <Link
                  className="font-semibold text-[#6d3cf5]"
                  href={salesListHref(report.day, "RETURNED")}
                >
                  Returned · {returned.count} {plural(returned.count, "sale")}
                </Link>
              }
              value={money(returned.totalCents)}
            />
            <Line label="…paid on them before the return" value={money(returned.paidCents)} />
            <Line
              label={
                <Link
                  className="font-semibold text-[#6d3cf5]"
                  href={salesListHref(report.day, "CANCELLED")}
                >
                  Voided / cancelled · {cancelled.count} {plural(cancelled.count, "sale")}
                </Link>
              }
              value={money(cancelled.totalCents)}
            />
            <Line label="…paid amounts recorded on them" value={money(cancelled.paidCents)} />
          </dl>
          <p className="mb-0 mt-3 text-[11px] leading-5 text-[#777985]">
            StoreIM records no refund amount or return date on a sale, so whether that money was
            handed back is not something this report can know.
            {drafts.count ? (
              <>
                {" "}
                <Link
                  className="font-semibold text-[#6d3cf5]"
                  href={salesListHref(report.day, "DRAFT")}
                >
                  {drafts.count} {plural(drafts.count, "draft")}
                </Link>{" "}
                dated this day {drafts.count === 1 ? "is" : "are"} not counted anywhere until
                completed.
              </>
            ) : null}
          </p>
        </section>
      </div>

      {empty ? null : <TransactionTable money={money} report={report} />}

      <details className={CARD}>
        <summary className="cursor-pointer text-sm font-semibold text-[#20212a]">
          How these figures are worked out
        </summary>
        <ul className="mb-0 mt-3 grid gap-2 pl-5 text-xs leading-5 text-[#555660]">
          <li>
            A sale belongs to the sale date chosen on it — the date the sales list filters by and
            the receipt prints. Times are shown in {report.timeZone}.
          </li>
          <li>
            <strong>Sold</strong> is completed sales only. Gross sales are price × quantity before
            any discount; net sales are gross less line and sale discounts; total billed is net
            sales plus tax and shipping.
          </li>
          <li>
            <strong>Received</strong> is the paid amount recorded on those completed sales, by the
            payment method on each. StoreIM keeps one paid amount per sale, not a list of payments,
            so a balance paid on a later day is counted on the day of the sale, not the day it was
            paid.
          </li>
          <li>
            <strong>Still unpaid</strong> is what those sales owe now.{" "}
            <strong>Total outstanding</strong> adds every earlier completed sale that still owes; it
            uses today&apos;s balances, so for a past date it is not what was owed at the end of
            that day.
          </li>
          <li>
            <strong>Returned</strong> and <strong>voided / cancelled</strong> sales are counted only
            in their own section — never as sales, received money or negative sales — so nothing is
            counted twice. Drafts are not counted.
          </li>
          <li>Storefront orders are not counter sales; they are in Orders and Transactions.</li>
        </ul>
      </details>
    </>
  );
}

function TransactionTable({
  money,
  report
}: {
  money: (cents: number) => string;
  report: DailySalesReport;
}) {
  const { pagination } = report;

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-base font-semibold text-[#20212a]">Transactions</h2>
        <p className="m-0 text-xs text-[#777985]">
          {pagination.from}–{pagination.to} of {pagination.total} · completed, returned and
          cancelled, oldest first
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left text-xs">
          <thead className="bg-[#f7f7f9] text-[#34353e]">
            <tr>
              <th className="rounded-l-md px-4 py-3 font-medium">Sale No</th>
              <th className="px-3 py-3 font-medium">Time</th>
              <th className="px-3 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 text-right font-medium">Total</th>
              <th className="px-3 py-3 text-right font-medium">Paid</th>
              <th className="px-3 py-3 text-right font-medium">Due</th>
              <th className="rounded-r-md px-4 py-3 font-medium">Payment</th>
            </tr>
          </thead>
          <tbody>
            {report.transactions.map((row) => (
              <tr className="border-b border-[#efeff4] transition hover:bg-[#fcfbff]" key={row.id}>
                <td className="px-4 py-3 font-semibold text-[#34353e]">
                  <Link
                    className="text-[#6d3cf5]"
                    href={`/dashboard/sales/${encodeURIComponent(row.id)}`}
                  >
                    {row.number}
                  </Link>
                </td>
                <td className="px-3 py-3 tabular-nums text-[#555660]">{row.time}</td>
                <td className="px-3 py-3">
                  {row.customer ?? <span className="text-[#85869a]">Walk-in</span>}
                </td>
                <td className="px-3 py-3">
                  <SaleStatusBadge status={row.status} />
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {money(row.totalCents)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{money(row.paidCents)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(row.dueCents)}</td>
                <td className="px-4 py-3">{row.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {pagination.all ? (
            <Link
              className="secondary link-button inline-flex h-9 items-center"
              href={dailyReportHref(report.day)}
            >
              Back to pages
            </Link>
          ) : (
            <>
              {pagination.page > 1 ? (
                <Link
                  className="secondary link-button inline-flex h-9 items-center"
                  href={dailyReportHref(report.day, { page: pagination.page - 1 })}
                >
                  Previous
                </Link>
              ) : null}
              <span className="text-[#777985]">
                Page {pagination.page} of {pagination.pageCount}
              </span>
              {pagination.page < pagination.pageCount ? (
                <Link
                  className="secondary link-button inline-flex h-9 items-center"
                  href={dailyReportHref(report.day, { page: pagination.page + 1 })}
                >
                  Next
                </Link>
              ) : null}
            </>
          )}
        </div>
        {!pagination.all && pagination.pageCount > 1 ? (
          <Link
            className="font-semibold text-[#6d3cf5]"
            href={dailyReportHref(report.day, { all: true })}
          >
            Show all {pagination.total} to print
          </Link>
        ) : null}
        {pagination.truncated ? (
          <span className="font-semibold text-amber-700">
            Only the first {pagination.to} are shown. The totals above include every sale.
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function DailySalesReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the report" className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div className={`${CARD} h-[104px] animate-pulse`} key={index} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className={`${CARD} h-[320px] animate-pulse`} />
        <div className={`${CARD} h-[320px] animate-pulse`} />
      </div>
      <div className={`${CARD} h-[280px] animate-pulse`} />
    </div>
  );
}

export function DailySalesReportError({
  href,
  linkLabel,
  message,
  title
}: {
  href: string;
  linkLabel: string;
  message: string;
  title: string;
}) {
  return (
    <section className={`${CARD} grid min-h-[220px] place-items-center text-center`} role="alert">
      <div>
        <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-amber-600" />
        <h2 className="mb-0 mt-3 text-lg font-semibold text-[#20212a]">{title}</h2>
        <p className="mt-2 text-sm text-[#777985]">{message}</p>
        <Link
          className="mt-4 inline-flex h-10 items-center rounded-lg border border-[#7c3aed] px-4 text-xs font-semibold text-[#6d3cf5]"
          href={href}
        >
          {linkLabel}
        </Link>
      </div>
    </section>
  );
}

function AnswerCard({ hint, label, value }: { hint: string; label: string; value: string }) {
  return (
    <section className={CARD}>
      <span className="text-xs font-semibold text-[#777985]">{label}</span>
      <strong className="mt-2 block text-xl tabular-nums text-[#20212a]">{value}</strong>
      <span className="mt-1 block text-[11px] text-[#85869a]">{hint}</span>
    </section>
  );
}

function Line({ label, strong, value }: { label: ReactNode; strong?: boolean; value: string }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${strong ? "border-t border-[#ececf5] pt-2 font-semibold text-[#20212a]" : "text-[#555660]"}`}
    >
      <dt>{label}</dt>
      <dd className="m-0 tabular-nums">{value}</dd>
    </div>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone: "warn" }) {
  return (
    <p
      className={`m-0 rounded-xl border px-5 py-3 text-sm font-semibold ${tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : ""}`}
      role="status"
    >
      {children}
    </p>
  );
}

function plural(count: number, word: string) {
  return count === 1 ? word : `${word}s`;
}
