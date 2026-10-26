"use client";

import { CircleCheck, Eye, FileDown, Plus, Printer, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_RECEIPT_PAPER,
  parseReceiptPaper,
  pxToMm,
  RECEIPT_PAPER_IDS,
  RECEIPT_PAPER_STORAGE_KEY,
  RECEIPT_PAPERS,
  RECEIPT_PRINT_ROOT_CLASS,
  receiptHref,
  receiptPageRule,
  receiptPrintRootStylesheet,
  receiptStylesheet,
  type ReceiptPaper,
  type SaleReceiptView
} from "../sale-receipt";
import { SaleReceipt } from "./sale-receipt";

type SaleReceiptScreenProps = {
  /** Open the print dialog once, on arrival — "Complete & print receipt". */
  autoPrint: boolean;
  /** Arrived straight from the counter: say the sale went through. */
  completed: boolean;
  receipt: SaleReceiptView;
  saleId: string;
};

/**
 * The counter's next screen: the sale is saved, here is its receipt.
 *
 * Everything on it is a read. Print and Save as PDF open the browser's own
 * dialog over a copy of the receipt portalled under `<body>` (the barcode
 * labels' pattern), so a cancelled dialog or a printer that is off costs
 * nothing — the sale was committed before this page could load, and Print can
 * be pressed again as often as it takes. "Complete & print" lands here with
 * `?print=1`; the dialog opens once and the flag is taken back out of the
 * address, so a refresh shows the receipt instead of printing it again.
 *
 * Keyboard: Print has focus on arrival, and New sale takes it after a print,
 * so Enter, Enter, Enter is print, confirm, next customer.
 */
export function SaleReceiptScreen({ autoPrint, completed, receipt, saleId }: SaleReceiptScreenProps) {
  const [paper, setPaper] = useState<ReceiptPaper>(DEFAULT_RECEIPT_PAPER);
  const [portalReady, setPortalReady] = useState(false);
  const [printed, setPrinted] = useState(false);
  const paperRef = useRef(paper);
  const previewRef = useRef<HTMLDivElement>(null);
  const printRootRef = useRef<HTMLDivElement>(null);
  const pageStyleRef = useRef<HTMLStyleElement | null>(null);
  const newSaleRef = useRef<HTMLAnchorElement>(null);
  const autoPrinted = useRef(false);
  const isSale = receipt.status.kind === "completed";

  useLayoutEffect(() => {
    paperRef.current = paper;
  });

  // The paper in this till's printer arrives after hydration, so the server's
  // render and the first client render agree.
  useEffect(() => {
    setPaper(readStoredPaper());
    setPortalReady(true);
  }, []);

  /**
   * The `@page` rule is written straight into its own `<style>`, not through
   * React state: `beforeprint` (which Ctrl+P fires too) has to set it before
   * the dialog lays the page out, and a re-render would land too late. The
   * roll's height is the preview's, which is the same markup at the same width.
   */
  const syncPageRule = useCallback(() => {
    const style = pageStyleRef.current;
    const preview = previewRef.current;

    if (style) {
      style.textContent = receiptPageRule(paperRef.current, preview ? pxToMm(preview.offsetHeight) : null);
    }
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    const afterPrint = () => {
      setPrinted(true);
      newSaleRef.current?.focus();
    };

    document.head.append(style);
    pageStyleRef.current = style;
    window.addEventListener("beforeprint", syncPageRule);
    window.addEventListener("afterprint", afterPrint);

    return () => {
      window.removeEventListener("beforeprint", syncPageRule);
      window.removeEventListener("afterprint", afterPrint);
      style.remove();
      pageStyleRef.current = null;
    };
  }, [syncPageRule]);

  const print = useCallback(async () => {
    // A logo still loading would print as a blank box.
    await imagesReady(printRootRef.current);
    syncPageRule();
    window.print();
  }, [syncPageRule]);

  useEffect(() => {
    if (!autoPrint || !portalReady) {
      return;
    }

    // Set inside the timer, not the effect, so React's development double-run
    // (which cancels the first timer) still prints exactly once.
    const timer = window.setTimeout(() => {
      if (autoPrinted.current) {
        return;
      }

      autoPrinted.current = true;
      window.history.replaceState(null, "", receiptHref(saleId, { completed }));
      void print();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [autoPrint, completed, portalReady, print, saleId]);

  function choosePaper(next: ReceiptPaper) {
    setPaper(next);
    storePaper(next);
  }

  return (
    <>
      <style>{receiptStylesheet() + receiptPrintRootStylesheet()}</style>

      {completed && isSale ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800" role="status">
          <CircleCheck aria-hidden="true" className="h-7 w-7 shrink-0" />
          <div className="min-w-0 flex-1">
            <strong className="block text-base">Sale completed — {receipt.receiptNumber}</strong>
            <span className="text-sm">
              Total {receipt.totals.total} · Paid {receipt.payment.paid}
              {receipt.payment.due ? ` · Due ${receipt.payment.due}` : ""}
            </span>
          </div>
        </div>
      ) : (
        <div>
          <p className="eyebrow">Sales</p>
          <h1 className="m-0 text-2xl font-semibold text-[#20212a]">Receipt {receipt.receiptNumber}</h1>
        </div>
      )}

      {!isSale && receipt.status.notice ? (
        <div
          className={`flex items-center gap-3 rounded-xl border px-5 py-4 text-sm font-semibold ${receipt.status.kind === "cancelled" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
          role="status"
        >
          <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
          {receipt.status.notice}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Print leads, and has focus, unless the dialog is about to open by itself. */}
          <button autoFocus={!autoPrint} className="primary inline-flex items-center gap-2 text-sm font-semibold" onClick={() => void print()} type="button">
            <Printer aria-hidden="true" className="h-4 w-4" /> Print receipt
          </button>
          <button className="secondary inline-flex items-center gap-2 text-sm font-semibold" onClick={() => void print()} type="button">
            <FileDown aria-hidden="true" className="h-4 w-4" /> Save as PDF
          </button>
          <Link className="secondary link-button inline-flex items-center gap-2 text-sm font-semibold" href="/dashboard/sales/new" ref={newSaleRef}>
            <Plus aria-hidden="true" className="h-4 w-4" /> New sale
          </Link>
          <Link className="secondary link-button inline-flex items-center gap-2 text-sm font-semibold" href={`/dashboard/sales/${encodeURIComponent(saleId)}`}>
            <Eye aria-hidden="true" className="h-4 w-4" /> View sale
          </Link>
          <div aria-label="Paper" className="ml-auto inline-flex rounded-lg border border-[#ddd6fe] p-0.5" role="group">
            {RECEIPT_PAPER_IDS.map((id) => (
              <button
                aria-pressed={paper === id}
                className={`h-9 rounded-md px-3 text-xs font-semibold ${paper === id ? "bg-[#f3f0ff] text-[#6d3cf5]" : "text-[#777985]"}`}
                key={id}
                onClick={() => choosePaper(id)}
                type="button"
              >
                {RECEIPT_PAPERS[id].label}
              </button>
            ))}
          </div>
        </div>
        <p className="m-0 text-xs leading-5 text-[#777985]">
          {printed
            ? "Didn't come out? Check the printer's paper and power, then print again — the sale is already saved and printing never changes it."
            : "For a PDF, choose “Save as PDF” as the destination in the print dialog. The paper size is remembered on this device."}
        </p>
      </section>

      <div className="overflow-x-auto rounded-xl border border-[#ececf5] bg-[#f7f7fa] p-6">
        <div className="mx-auto w-max shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <SaleReceipt paper={paper} receipt={receipt} ref={previewRef} />
        </div>
      </div>

      {portalReady
        ? createPortal(
            <div aria-hidden="true" className={RECEIPT_PRINT_ROOT_CLASS} ref={printRootRef}>
              <SaleReceipt paper={paper} receipt={receipt} />
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function imagesReady(root: HTMLElement | null, timeoutMs = 1500) {
  const pending = Array.from(root?.querySelectorAll("img") ?? []).filter((image) => !image.complete);

  if (!pending.length) {
    return Promise.resolve();
  }

  return Promise.race([
    Promise.all(
      pending.map(
        (image) =>
          new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          })
      )
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))
  ]);
}

function readStoredPaper() {
  try {
    return parseReceiptPaper(window.localStorage.getItem(RECEIPT_PAPER_STORAGE_KEY));
  } catch {
    return DEFAULT_RECEIPT_PAPER;
  }
}

function storePaper(paper: ReceiptPaper) {
  try {
    window.localStorage.setItem(RECEIPT_PAPER_STORAGE_KEY, paper);
  } catch {
    // A private window, or storage switched off: the choice still applies to this visit.
  }
}
