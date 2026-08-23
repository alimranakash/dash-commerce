"use client";

import { Copy, Eye, Loader2, Pencil, RefreshCcw, ShieldQuestion, Truck, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  checkCourierScoreAction,
  refreshActiveShipmentsAction,
  refreshShipmentStatusAction,
  sendOrderToCourierAction,
  sendOrdersToCourierAction
} from "../courier.actions";
import { PlanUpgradeDialog } from "../../billing/components/plan-upgrade-dialog";
import type { PlanFeatureKey } from "../../billing/plan-features";
import type { BulkSendResult } from "../courier.service";

/**
 * The orders-list courier surface: selection, the bulk bar, a confirm sheet, and
 * per-row actions.
 *
 * Nothing here decides anything about safety — the cap, the skip-already-sent
 * filter, row reservation and the no-retry-on-timeout rule all live in the
 * service. The UI's job is to make the size of the action legible *before* it
 * happens, which is what the confirm sheet is for.
 */

export type OrderCourierRow = {
  codAmount: number;
  courierLabel: string | null;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  id: string;
  itemCount: number;
  lastSyncedLabel: string | null;
  orderNumber: string;
  paymentStatus: string;
  providerStatus: string | null;
  shipmentId: string | null;
  shipmentStatus: string | null;
  status: string;
  total: string;
  trackingCode: string | null;
};

const maxSelection = 50;

export function OrdersCourierTable({
  courierLabel,
  rows,
  sendDisabledReason
}: {
  courierLabel: string;
  rows: OrderCourierRow[];
  sendDisabledReason: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<BulkSendResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [lockedFeature, setLockedFeature] = useState<PlanFeatureKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const alreadySent = selectedRows.filter((row) => row.shipmentId && row.shipmentStatus !== "FAILED");
  const sendable = selectedRows.filter((row) => !row.shipmentId || row.shipmentStatus === "FAILED");
  const totalCod = sendable.reduce((total, row) => total + row.codAmount, 0);
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleAllVisible() {
    setSelected(allVisibleSelected ? new Set() : new Set(rows.map((row) => row.id)));
  }

  function runBulkSend() {
    setConfirming(false);

    startTransition(async () => {
      const response = await sendOrdersToCourierAction(selectedRows.map((row) => row.id));

      setNote(response.message ?? null);
      setResult(response.result);

      if (response.result) {
        // Keep only the rows that still need attention selected, so "Retry
        // failed" is literally the same button again.
        const keep = new Set(
          response.result.failed.map((entry) => entry.orderNumber)
        );

        setSelected(new Set(rows.filter((row) => keep.has(row.orderNumber)).map((row) => row.id)));
      }
    });
  }

  function refreshAllActive() {
    startTransition(async () => {
      const response = await refreshActiveShipmentsAction();

      setNote(response.message ?? null);
    });
  }

  /**
   * Scores every selected customer in one go. Sequential rather than parallel so
   * it stays inside the provider rate limiter, and de-duplicated because the same
   * customer often has several open orders.
   */
  function runBulkFraudCheck() {
    const phones = [...new Set(selectedRows.map((row) => row.customerPhone).filter(Boolean))];

    startTransition(async () => {
      let withHistory = 0;
      let risky = 0;
      let caution = 0;
      let unknown = 0;

      for (const phone of phones) {
        const response = await checkCourierScoreAction(phone);

        if (response.lockedFeature) {
          setLockedFeature(response.lockedFeature);
          return;
        }

        const score = response.score;

        if (!score || score.totalParcels === 0) {
          unknown += 1;
          continue;
        }

        withHistory += 1;

        if (score.band === "RISKY") {
          risky += 1;
        } else if (score.band === "CAUTION") {
          caution += 1;
        }
      }

      setNote(
        `Fraud check on ${phones.length} customer(s): ${risky} risky, ${caution} caution, ` +
          `${withHistory - risky - caution} reliable, ${unknown} with no history.`
      );
    });
  }

  return (
    <>
      <PlanUpgradeDialog feature={lockedFeature} onClose={() => setLockedFeature(null)} />
      <div className="table-card">
        <table className="resource-table">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  aria-label="Select all visible orders"
                  checked={allVisibleSelected}
                  className="h-4 w-4 rounded border-[#dedcea] accent-[#7548f5]"
                  onChange={toggleAllVisible}
                  type="checkbox"
                />
              </th>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Courier</th>
              <th>Tracking</th>
              <th>Delivery</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td data-label="Select">
                  <input
                    aria-label={`Select order ${row.orderNumber}`}
                    checked={selected.has(row.id)}
                    className="h-4 w-4 rounded border-[#dedcea] accent-[#7548f5]"
                    onChange={() => toggle(row.id)}
                    type="checkbox"
                  />
                </td>
                <td data-label="Order">
                  <strong>{row.orderNumber}</strong>
                  <span>{row.itemCount} item(s)</span>
                </td>
                <td data-label="Customer">
                  {row.customerName}
                  <span>{row.customerPhone}</span>
                </td>
                <td data-label="Total">{row.total}</td>
                <td data-label="Courier">
                  {row.courierLabel ? (
                    <span className="status-pill">{row.courierLabel}</span>
                  ) : (
                    <span className="text-[#a2a3b0]">—</span>
                  )}
                </td>
                <td data-label="Tracking">
                  {row.trackingCode ? <CopyableCode value={row.trackingCode} /> : <span className="text-[#a2a3b0]">—</span>}
                </td>
                <td data-label="Delivery">
                  {row.shipmentStatus ? (
                    <span className="grid gap-0.5">
                      <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${statusTone(row.shipmentStatus)}`}>
                        {row.providerStatus ?? row.shipmentStatus.toLowerCase()}
                      </span>
                      {row.lastSyncedLabel ? (
                        <span className="text-[10px] text-[#a2a3b0]">{row.lastSyncedLabel}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-[#a2a3b0]">Not sent</span>
                  )}
                </td>
                <td data-label="Payment">
                  <span className="status-pill">{row.paymentStatus.toLowerCase()}</span>
                </td>
                <td data-label="Actions">
                  <RowActions
                    courierLabel={courierLabel}
                    onNote={setNote}
                    row={row}
                    sendDisabledReason={sendDisabledReason}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result ? <ResultSummary onDismiss={() => setResult(null)} result={result} /> : null}

      {note && !result ? (
        <p className="m-0 rounded-lg bg-[#f7f4ff] px-4 py-3 text-xs text-[#6c6380]">{note}</p>
      ) : null}

      {selected.size > 0 ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-[#dcd9e8] bg-white px-5 py-4 shadow-[0_12px_32px_rgba(62,54,114,0.16)]">
          <strong className="text-sm text-[#20212a]">{selected.size} order(s) selected</strong>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#7548f5] px-4 text-xs font-semibold text-white hover:bg-[#6436e8] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || sendable.length === 0 || Boolean(sendDisabledReason)}
            onClick={() => setConfirming(true)}
            title={sendDisabledReason ?? undefined}
            type="button"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
            Send to {courierLabel}
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-3.5 text-xs font-semibold text-[#5f616d] hover:bg-[#faf9ff] disabled:opacity-60"
            disabled={isPending}
            onClick={refreshAllActive}
            type="button"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh status
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-3.5 text-xs font-semibold text-[#5f616d] hover:bg-[#faf9ff] disabled:opacity-60"
            disabled={isPending}
            onClick={runBulkFraudCheck}
            type="button"
          >
            <ShieldQuestion className="h-3.5 w-3.5" />
            Fraud check
          </button>
          <button
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#777985] hover:text-[#20212a]"
            onClick={() => setSelected(new Set())}
            type="button"
          >
            <X className="h-3.5 w-3.5" />Clear
          </button>
        </div>
      ) : null}

      {confirming ? (
        <ConfirmSheet
          alreadySent={alreadySent.length}
          courierLabel={courierLabel}
          onCancel={() => setConfirming(false)}
          onConfirm={runBulkSend}
          sendable={sendable.length}
          totalCod={totalCod}
        />
      ) : null}
    </>
  );
}

function RowActions({
  courierLabel,
  onNote,
  row,
  sendDisabledReason
}: {
  courierLabel: string;
  onNote: (note: string | null) => void;
  row: OrderCourierRow;
  sendDisabledReason: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function run(work: () => Promise<{ message?: string }>) {
    startTransition(async () => {
      onNote((await work()).message ?? null);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <IconLink href={`/dashboard/orders/${row.id}`} label="View order" primary>
        <Eye className="h-3.5 w-3.5" />
      </IconLink>
      {/* Beside View so a wrong name or address can be corrected without
          opening the order first. */}
      <IconLink href={`/dashboard/orders/${row.id}/edit`} label="Edit order">
        <Pencil className="h-3.5 w-3.5" />
      </IconLink>
      {row.shipmentId ? (
        <IconButton
          disabled={isPending}
          label="Refresh delivery status"
          onClick={() => run(() => refreshShipmentStatusAction(row.shipmentId ?? "", row.id))}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
        </IconButton>
      ) : (
        <IconButton
          disabled={isPending || Boolean(sendDisabledReason)}
          label={sendDisabledReason ?? `Send to ${courierLabel}`}
          onClick={() => run(() => sendOrderToCourierAction(row.id))}
        >
          <Truck className="h-3.5 w-3.5" />
        </IconButton>
      )}
      <IconButton
        disabled={isPending}
        label="Fraud check"
        onClick={() =>
          run(async () => {
            const response = await checkCourierScoreAction(row.customerPhone);
            const score = response.score;

            return {
              message:
                score && score.totalParcels > 0
                  ? `${row.customerPhone}: ${score.successRatio}% delivered (${score.totalDelivered}/${score.totalParcels}).`
                  : response.message ?? `${row.customerPhone}: no delivery history.`
            };
          })
        }
      >
        <ShieldQuestion className="h-3.5 w-3.5" />
      </IconButton>
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7548f5]" /> : null}
    </div>
  );
}

/** Shared chrome for the row's action strip, buttons and links alike. */
const iconActionClass =
  "grid h-7 w-7 place-items-center rounded-lg border border-[#e5e3f1] bg-white transition hover:border-[#bdb6da] hover:text-[#6d3cf5] disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The navigating twin of IconButton, so View and Edit read as part of the same
 * strip as the courier and fraud actions rather than as stray text links.
 */
function IconLink({
  children,
  href,
  label,
  primary
}: {
  children: React.ReactNode;
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      aria-label={label}
      className={`${iconActionClass} ${primary ? "text-[#6d3cf5]" : "text-[#5f616d]"}`}
      href={href}
      title={label}
    >
      {children}
    </Link>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick
}: {
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={`${iconActionClass} text-[#5f616d]`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function ConfirmSheet({
  alreadySent,
  courierLabel,
  onCancel,
  onConfirm,
  sendable,
  totalCod
}: {
  alreadySent: number;
  courierLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  sendable: number;
  totalCod: number;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#ececf5] bg-white p-6 shadow-[0_24px_64px_rgba(20,18,40,0.28)]">
        <h2 className="m-0 text-base font-semibold text-[#20212a]">
          Book {sendable} real parcel{sendable === 1 ? "" : "s"}?
        </h2>
        <p className="mt-2 text-xs leading-6 text-[#777985]">
          This creates consignments with {courierLabel} immediately. It cannot be undone from here —
          cancelling a booked parcel is done in the {courierLabel} portal.
        </p>
        <dl className="mt-4 grid gap-2 rounded-lg bg-[#f8f7fc] p-4 text-xs">
          <Row label="Carrier" value={courierLabel} />
          <Row label="Orders to send" value={String(sendable)} />
          <Row label="Total COD to collect" value={`৳${totalCod.toLocaleString("en-BD")}`} />
          {alreadySent > 0 ? (
            <Row label="Skipped (already sent)" value={String(alreadySent)} />
          ) : null}
          {sendable > maxSelection ? <Row label="Cap" value={`${maxSelection} per run`} /> : null}
        </dl>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="h-10 rounded-lg border border-[#dcd9e8] bg-white px-4 text-xs font-semibold text-[#5f616d] hover:bg-[#faf9ff]"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-lg bg-[#7548f5] px-4 text-xs font-semibold text-white hover:bg-[#6436e8]"
            onClick={onConfirm}
            type="button"
          >
            Send {sendable} to {courierLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultSummary({ onDismiss, result }: { onDismiss: () => void; result: BulkSendResult }) {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="flex flex-wrap items-center gap-2">
        <Pill tone="ok">{result.sent.length} sent</Pill>
        <Pill tone="warn">{result.skipped.length} skipped</Pill>
        <Pill tone="risk">{result.failed.length} failed</Pill>
        {result.needsReconciliation.length > 0 ? (
          <Pill tone="warn">{result.needsReconciliation.length} need checking</Pill>
        ) : null}
        <button
          className="ml-auto text-[11px] font-semibold text-[#777985] hover:text-[#20212a]"
          onClick={onDismiss}
          type="button"
        >
          Dismiss
        </button>
      </header>

      {result.needsReconciliation.length > 0 ? (
        <p className="m-0 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
          <strong>Do not re-send these.</strong> The courier may already have created them; each was
          checked by invoice and the result is below.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3">
        <Group
          entries={result.failed.map((entry): [string, string] => [entry.orderNumber, entry.message])}
          title="Failed"
        />
        <Group
          entries={result.needsReconciliation.map((entry): [string, string] => [
            entry.orderNumber,
            entry.message
          ])}
          title="Need checking"
        />
        <Group
          entries={result.skipped.map((entry): [string, string] => [entry.orderNumber, entry.reason])}
          title="Skipped"
        />
        <Group
          entries={result.sent.map((entry): [string, string] => [
            entry.orderNumber,
            entry.trackingCode ?? "booked"
          ])}
          title="Sent"
        />
      </div>
    </section>
  );
}

function Group({ entries, title }: { entries: Array<[string, string]>; title: string }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <details className="rounded-lg border border-[#f0eff7] px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-[#33343e]">
        {title} ({entries.length})
      </summary>
      <ul className="mt-2 grid gap-1.5">
        {entries.map(([orderNumber, message]) => (
          <li className="text-[11px] leading-5 text-[#5f616d]" key={`${title}-${orderNumber}`}>
            <strong className="text-[#292a34]">{orderNumber}</strong> — {message}
          </li>
        ))}
      </ul>
    </details>
  );
}

function CopyableCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#292a34] hover:text-[#6d3cf5]"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Copy tracking code"
      type="button"
    >
      {value}
      <Copy className="h-3 w-3" />
      {copied ? <span className="text-[10px] text-emerald-600">copied</span> : null}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="m-0 text-[#777985]">{label}</dt>
      <dd className="m-0 font-semibold text-[#292a34]">{value}</dd>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "ok" | "risk" | "warn" }) {
  const tones = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    risk: "border-rose-200 bg-rose-50 text-rose-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700"
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function statusTone(status: string) {
  if (status === "DELIVERED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["BOOKED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "PARTIALLY_DELIVERED", "PICKED_UP"].includes(status)) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (["CANCELLED", "FAILED", "LOST", "RETURNED"].includes(status)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}
