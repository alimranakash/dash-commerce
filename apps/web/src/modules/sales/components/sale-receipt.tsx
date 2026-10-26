import type { Ref } from "react";
import { RECEIPT_CLASS, type ReceiptPaper, type SaleReceiptView } from "../sale-receipt";

type SaleReceiptProps = {
  paper: ReceiptPaper;
  receipt: SaleReceiptView;
  ref?: Ref<HTMLDivElement> | undefined;
};

/**
 * The receipt as paper — the on-screen preview and the printed copy are this
 * one component, styled by `receiptStylesheet`. Only divs and spans, so no
 * dashboard rule written for a heading or a paragraph can reach it.
 */
export function SaleReceipt({ paper, receipt, ref }: SaleReceiptProps) {
  const { customer, issued, payment, store, totals } = receipt;

  return (
    <div className={RECEIPT_CLASS} data-paper={paper} data-status={receipt.status.kind} ref={ref}>
      <div className="r-head">
        {store.logoUrl ? <img alt="" className="r-logo" src={store.logoUrl} /> : null}
        <div className="r-store">{store.name}</div>
        {store.addressLines.map((line, index) => (
          <div className="r-small" key={index}>
            {line}
          </div>
        ))}
        {store.phone ? <div className="r-small">Phone: {store.phone}</div> : null}
        {store.email ? <div className="r-small">{store.email}</div> : null}
      </div>

      <div className="r-title">{receipt.status.title}</div>
      {receipt.status.notice ? <div className="r-stamp">{receipt.status.notice}</div> : null}

      <div className="r-meta">
        <Row label="Receipt no." value={receipt.receiptNumber} />
        <Row label="Date" value={issued.date} />
        {issued.recorded ? <Row label="Recorded" value={issued.recorded} /> : null}
        {receipt.saleTypeLabel ? <Row label="Sale" value={receipt.saleTypeLabel} /> : null}
        <Row label="Customer" value={customer?.name ?? "Walk-in customer"} />
        {customer?.phone ? <Row label="Phone" value={customer.phone} /> : null}
      </div>

      <div className="r-rule" />

      <div className="r-items">
        <div className="r-item r-items-head">
          <span className="r-item-name">Item</span>
          <span className="r-item-calc">Qty × Price</span>
          <span className="r-item-total">Total</span>
        </div>
        {receipt.lines.map((line) => (
          <div className="r-item" key={line.key}>
            <span className="r-item-name">{line.name}</span>
            <span className="r-item-calc">
              <span>
                {line.quantity} × {line.unitPrice}
              </span>
              {line.discount ? <span>less {line.discount}</span> : null}
            </span>
            <span className="r-item-total">{line.total}</span>
          </div>
        ))}
      </div>

      <div className="r-rule" />

      <div className="r-totals">
        <Row label="Subtotal" value={totals.subtotal} />
        {totals.discount ? <Row label="Discount" value={`− ${totals.discount}`} /> : null}
        {totals.tax ? <Row label="Tax" value={`+ ${totals.tax}`} /> : null}
        {totals.shipping ? <Row label="Shipping" value={`+ ${totals.shipping}`} /> : null}
        <Row className="r-grand" label="Total" value={totals.total} />
      </div>

      <div className="r-rule" />

      <div className="r-pay">
        <Row label={`Paid · ${payment.method}`} value={payment.paid} />
        {payment.due ? <Row className="r-due" label="Due" value={payment.due} /> : null}
        <Row label="Payment" value={payment.status} />
        <Row label="Items" value={String(receipt.itemCount)} />
      </div>

      <div className="r-rule" />

      <div className="r-foot">
        {receipt.footer.thanks.map((line) => (
          <div className="r-strong" key={line}>
            {line}
          </div>
        ))}
        {receipt.status.notice ? <div className="r-strong">{receipt.status.notice}</div> : null}
        <div className="r-small">{receipt.footer.disclaimer}</div>
      </div>
    </div>
  );
}

function Row({ className = "", label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={`r-row ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
