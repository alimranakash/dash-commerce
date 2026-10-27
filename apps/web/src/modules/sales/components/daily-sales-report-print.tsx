"use client";

import { FileDown, Printer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DAILY_REPORT_PAPER_CLASS,
  DAILY_REPORT_PRINT_ROOT_CLASS,
  dailyReportPaperStylesheet,
  dailyReportPrintRootStylesheet,
  formatReportMoney,
  type DailySalesReport
} from "../sale-daily-report";
import { title } from "./sale-badges";

/**
 * Print and Save as PDF, both the browser's own dialog, over an A4 copy of the
 * report portalled under `<body>` — the receipt's pattern, so the dashboard
 * around it never reaches the paper. Everything here is a read of the report
 * the server already built: printing cannot change a sale.
 */
export function DailySalesReportPrint({ report }: { report: DailySalesReport }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <>
      <style>{dailyReportPrintRootStylesheet() + dailyReportPaperStylesheet()}</style>
      <button
        className="primary inline-flex items-center gap-2 text-sm font-semibold"
        onClick={() => window.print()}
        type="button"
      >
        <Printer aria-hidden="true" className="h-4 w-4" /> Print report
      </button>
      <button
        className="secondary inline-flex items-center gap-2 text-sm font-semibold"
        onClick={() => window.print()}
        title="Choose “Save as PDF” as the destination in the print dialog"
        type="button"
      >
        <FileDown aria-hidden="true" className="h-4 w-4" /> Save as PDF
      </button>
      {ready
        ? createPortal(
            <div aria-hidden="true" className={DAILY_REPORT_PRINT_ROOT_CLASS}>
              <DailySalesReportPaper report={report} />
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function DailySalesReportPaper({ report }: { report: DailySalesReport }) {
  const money = (cents: number) => formatReportMoney(cents, report.currency);
  const { cancelled, completed, methods, outstanding, returned } = report.figures;
  const { pagination } = report;
  const methodTotals = methods.reduce(
    (sum, row) => ({
      count: sum.count + row.count,
      due: sum.due + row.dueCents,
      paid: sum.paid + row.paidCents,
      total: sum.total + row.totalCents
    }),
    { count: 0, due: 0, paid: 0, total: 0 }
  );

  return (
    <div className={DAILY_REPORT_PAPER_CLASS}>
      <div className="d-head">
        <div>
          <h1>{report.storeName}</h1>
          <div className="d-strong">Daily sales report — {report.dayLabel}</div>
        </div>
        <div className="d-meta">
          <div>Printed {report.generatedAt}</div>
          <div>Times in {report.timeZone}</div>
        </div>
      </div>

      <h2>Summary</h2>
      <div className="d-grid">
        <div>
          <Row
            label={`Completed sales (${completed.count})`}
            strong
            value={money(completed.totalCents)}
          />
          <Row label="Gross sales" value={money(completed.grossCents)} />
          <Row label="Discounts" value={`− ${money(completed.discountCents)}`} />
          <Row label="Net sales" strong value={money(completed.netCents)} />
          <Row label="Tax" value={`+ ${money(completed.taxCents)}`} />
          <Row label="Shipping" value={`+ ${money(completed.shippingCents)}`} />
        </div>
        <div>
          <Row label="Received on these sales" strong value={money(completed.paidCents)} />
          <Row
            label={`Still due on these sales (${completed.withDueCount})`}
            value={money(completed.dueCents)}
          />
          <Row
            label={`Outstanding up to this date (${outstanding.count})`}
            value={money(outstanding.totalCents)}
          />
          <Row label="…of which from earlier days" value={money(outstanding.earlierCents)} />
          <Row label={`Returned (${returned.count})`} value={money(returned.totalCents)} />
          <Row
            label={`Voided / cancelled (${cancelled.count})`}
            value={money(cancelled.totalCents)}
          />
        </div>
      </div>

      <h2>Payment methods — completed sales</h2>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th className="d-num">Sales</th>
            <th className="d-num">Billed</th>
            <th className="d-num">Received</th>
            <th className="d-num">Due</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((row) => (
            <tr key={row.method}>
              <td>{row.label}</td>
              <td className="d-num">{row.count}</td>
              <td className="d-num">{money(row.totalCents)}</td>
              <td className="d-num">{money(row.paidCents)}</td>
              <td className="d-num">{money(row.dueCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="d-num">{methodTotals.count}</td>
            <td className="d-num">{money(methodTotals.total)}</td>
            <td className="d-num">{money(methodTotals.paid)}</td>
            <td className="d-num">{money(methodTotals.due)}</td>
          </tr>
        </tfoot>
      </table>

      <h2>Transactions</h2>
      {report.transactions.length ? (
        <table>
          <thead>
            <tr>
              <th>Sale</th>
              <th>Time</th>
              <th>Customer</th>
              <th>Status</th>
              <th className="d-num">Total</th>
              <th className="d-num">Paid</th>
              <th className="d-num">Due</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            {report.transactions.map((row) => (
              <tr key={row.id}>
                <td>{row.number}</td>
                <td>{row.time}</td>
                <td>{row.customer ?? "Walk-in"}</td>
                <td>{title(row.status)}</td>
                <td className="d-num">{money(row.totalCents)}</td>
                <td className="d-num">{money(row.paidCents)}</td>
                <td className="d-num">{money(row.dueCents)}</td>
                <td>{row.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No completed, returned or cancelled sales are dated this day.</p>
      )}
      {pagination.total > report.transactions.length ? (
        <p className="d-note d-strong">
          Showing transactions {pagination.from}–{pagination.to} of {pagination.total}. The summary
          above covers all of them.
        </p>
      ) : null}

      <p className="d-note">
        Sales are dated by the sale date chosen on each sale. Received is the amount paid recorded
        on the day&apos;s completed sales, by the payment method on each sale; a balance paid later
        is counted on the day of the sale. Returned and cancelled sales are kept out of sales and
        received. Outstanding is at current balances.
      </p>
    </div>
  );
}

function Row({ label, strong, value }: { label: ReactNode; strong?: boolean; value: string }) {
  return (
    <div className={`d-row${strong ? " d-strong" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
