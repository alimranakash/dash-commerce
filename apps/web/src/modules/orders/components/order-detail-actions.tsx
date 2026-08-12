"use client";

import { ArrowLeft, BadgeCheck, Download, FileText, PackageCheck, Printer, RefreshCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SendToCourierButton } from "../../courier/components/send-to-courier-button";
import {
  updateFulfillmentStatusFormAction,
  updateOrderStatusFormAction,
  updatePaymentStatusFormAction
} from "../order.actions";

export function OrderHeaderActions() {
  const [message, setMessage] = useState("");
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Link className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dedcea] bg-white px-3.5 text-xs font-semibold text-[#555762] hover:bg-[#f8f7fc]" href="/dashboard/orders"><ArrowLeft className="h-4 w-4" />Back to Orders</Link>
        <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#7c3aed] bg-white px-3.5 text-xs font-semibold text-[#6d3cf5] hover:bg-[#f7f3ff]" onClick={() => window.print()} type="button"><Printer className="h-4 w-4" />Print Invoice</button>
        <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#7548f5] px-3.5 text-xs font-semibold text-white hover:bg-[#6436e8]" onClick={() => setMessage("Invoice download will be available when PDF invoices are connected.")} type="button"><Download className="h-4 w-4" />Download Invoice</button>
      </div>
      {message ? <p className="m-0 text-right text-[11px] text-[#777985]">{message}</p> : null}
    </div>
  );
}

export function OrderQuickActions({ courierLabel, hasShipment, orderId, sendDisabledReason }: {
  courierLabel: string;
  hasShipment: boolean;
  orderId: string;
  sendDisabledReason?: string | undefined;
}) {
  const actions = [
    { action: updateOrderStatusFormAction.bind(null, orderId, "PROCESSING"), icon: RefreshCcw, label: "Mark Processing", style: "border-blue-200 bg-blue-50 text-blue-700" },
    { action: updateOrderStatusFormAction.bind(null, orderId, "COMPLETED"), icon: PackageCheck, label: "Mark Completed", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    // Explicit seller override. Delivery progress is projected from the shipment
    // in Phase 2; until then this is the only writer of fulfillmentStatus.
    { action: updateFulfillmentStatusFormAction.bind(null, orderId, "FULFILLED"), icon: BadgeCheck, label: "Mark Fulfilled", style: "border-teal-200 bg-teal-50 text-teal-700" },
    { action: updateOrderStatusFormAction.bind(null, orderId, "CANCELLED"), icon: XCircle, label: "Cancel Order", style: "border-rose-200 bg-rose-50 text-rose-700" },
    { action: updatePaymentStatusFormAction.bind(null, orderId, "PAID"), icon: FileText, label: "Mark Paid", style: "border-violet-200 bg-violet-50 text-violet-700" }
  ];

  return (
    <div className="grid gap-3">
      {actions.map(({ action, icon: Icon, label, style }) => (
        <form action={action} key={label}>
          <button className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-3.5 text-left text-xs font-semibold transition hover:brightness-95 ${style}`} type="submit"><Icon className="h-4 w-4" />{label}</button>
        </form>
      ))}
      {hasShipment ? null : (
        <SendToCourierButton
          courierLabel={courierLabel}
          orderId={orderId}
          variant="quiet"
          {...(sendDisabledReason ? { disabledReason: sendDisabledReason } : {})}
        />
      )}
    </div>
  );
}
