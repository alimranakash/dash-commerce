import {
  buildDailySalesReport,
  reportPagination,
  summarizeDailySales,
  type DailySalesReport
} from "./sale-daily-report";
import { getDailySaleTransactions, getDailySalesFacts } from "./sale.repository";

export type DailyReportStore = {
  currency: string;
  id: string;
  name: string;
  organizationId: string;
};

/**
 * One business day's report for the store the session resolved.
 *
 * The totals are summed by the database; only the page of the transaction
 * table being shown is read as rows, and its size comes from those totals, so
 * a busy day costs the same as a quiet one. Every query is scoped by the
 * store's organization and id through `dailyReportWhere` — the request can
 * choose the day, the page and nothing else.
 */
export async function getDailySalesReport(
  store: DailyReportStore,
  request: { all: boolean; day: string; page: number },
  clock: { now: Date; timeZone: string; today: string }
): Promise<DailySalesReport> {
  const scope = { organizationId: store.organizationId, storeId: store.id };
  const figures = summarizeDailySales(await getDailySalesFacts(scope, request.day));
  const pagination = reportPagination(figures.transactionCount, request.page, request.all);
  const records =
    pagination.take > 0 && pagination.total > 0
      ? await getDailySaleTransactions(scope, request.day, pagination)
      : [];

  return buildDailySalesReport({
    currency: store.currency,
    day: request.day,
    figures,
    now: clock.now,
    pagination,
    records,
    storeName: store.name,
    timeZone: clock.timeZone,
    today: clock.today
  });
}
