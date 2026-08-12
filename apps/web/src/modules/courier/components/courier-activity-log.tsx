import { History } from "lucide-react";
import Link from "next/link";
import type { CourierActivityEntry } from "../courier.service";

/**
 * Recent courier activity, so a seller can see why a booking failed or when a
 * status last synced without needing database access. Read-only and derived
 * entirely from DeliveryEvent, which every phase already writes to.
 */
export function CourierActivityLog({ entries }: { entries: CourierActivityEntry[] }) {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-[#7548f5]" />
        <h2 className="m-0 text-sm font-semibold text-[#20212a]">Recent courier activity</h2>
      </header>

      {entries.length === 0 ? (
        <p className="m-0 text-xs leading-6 text-[#777985]">
          Nothing yet. Bookings, failures and status checks will appear here as they happen.
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {entries.map((entry) => (
            <li className="grid gap-0.5 border-b border-[#f5f4fa] pb-2.5 last:border-0 last:pb-0" key={entry.id}>
              <span className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(entry.status)}`}>
                  {entry.status.replace(/_/g, " ").toLowerCase()}
                </span>
                {entry.orderId ? (
                  <Link className="font-semibold text-[#6d3cf5]" href={`/dashboard/orders/${entry.orderId}`}>
                    {entry.orderNumber}
                  </Link>
                ) : (
                  <span className="font-semibold text-[#292a34]">{entry.orderNumber}</span>
                )}
                <span className="text-[#5f616d]">{entry.message}</span>
              </span>
              <span className="text-[10px] text-[#a2a3b0]">
                {entry.providerLabel} · {sourceLabel(entry.source)} · {formatDate(entry.occurredAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function sourceLabel(source: string) {
  switch (source) {
    case "MANUAL":
      return "by seller";
    case "PROVIDER_POLL":
      return "status check";
    case "PROVIDER_WEBHOOK":
      return "courier update";
    default:
      return "system";
  }
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
