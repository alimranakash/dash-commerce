"use client";

import { ArrowLeft, Download, FileText, PackageCheck, Printer, RefreshCcw, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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

export function OrderQuickActions() {
  const [message, setMessage] = useState("");
  const actions = [
    { icon: RefreshCcw, label: "Mark Processing", style: "border-blue-200 bg-blue-50 text-blue-700" },
    { icon: PackageCheck, label: "Mark Completed", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    { icon: XCircle, label: "Cancel Order", style: "border-rose-200 bg-rose-50 text-rose-700" },
    { icon: FileText, label: "Create Invoice", style: "border-violet-200 bg-violet-50 text-violet-700" },
    { icon: Truck, label: "Create Courier Booking", style: "border-[#dedcea] bg-white text-[#555762]" }
  ];

  return (
    <div className="grid gap-3">
      {actions.map(({ icon: Icon, label, style }) => <button className={`flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-left text-xs font-semibold transition hover:brightness-95 ${style}`} key={label} onClick={() => setMessage(`${label} will be available when order workflow actions are connected.`)} type="button"><Icon className="h-4 w-4" />{label}</button>)}
      {message ? <p className="m-0 rounded-lg bg-[#f7f4ff] px-3 py-2 text-[11px] leading-5 text-[#6c6380]">{message}</p> : null}
    </div>
  );
}
