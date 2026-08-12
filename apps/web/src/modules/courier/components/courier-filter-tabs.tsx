import Link from "next/link";

/**
 * Courier-state filter for the orders list. Server-rendered links so it composes
 * with the existing status/search/date filters rather than fighting them.
 */

export type CourierFilterKey =
  | "all"
  | "delivered"
  | "failed"
  | "in-transit"
  | "not-sent"
  | "returned"
  | "sent";

const tabs: Array<{ key: CourierFilterKey; label: string }> = [
  { key: "all", label: "All couriers" },
  { key: "not-sent", label: "Not sent" },
  { key: "sent", label: "Sent" },
  { key: "in-transit", label: "In transit" },
  { key: "delivered", label: "Delivered" },
  { key: "returned", label: "Returned" },
  { key: "failed", label: "Failed" }
];

/** Internal shipment statuses behind each tab. `not-sent` means no shipment row. */
const statusGroups: Record<Exclude<CourierFilterKey, "all" | "not-sent">, string[]> = {
  delivered: ["DELIVERED", "PARTIALLY_DELIVERED"],
  failed: ["FAILED"],
  "in-transit": ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "HOLD"],
  returned: ["RETURNED", "CANCELLED"],
  sent: ["REQUESTED", "BOOKED"]
};

export function matchesCourierFilter(filter: CourierFilterKey, shipmentStatus: string | null) {
  if (filter === "all") {
    return true;
  }

  if (filter === "not-sent") {
    return shipmentStatus === null;
  }

  return shipmentStatus !== null && statusGroups[filter].includes(shipmentStatus);
}

export function parseCourierFilter(value: string): CourierFilterKey {
  return tabs.some((tab) => tab.key === value) ? (value as CourierFilterKey) : "all";
}

export function CourierFilterTabs({
  activeFilter,
  counts,
  params
}: {
  activeFilter: CourierFilterKey;
  counts: Record<CourierFilterKey, number>;
  params: Record<string, string>;
}) {
  return (
    <nav
      aria-label="Courier status filters"
      className="-mb-px flex min-w-0 gap-5 overflow-x-auto border-b border-[#eeeeF5]"
    >
      {tabs.map((tab) => {
        const search = new URLSearchParams(params);

        if (tab.key === "all") {
          search.delete("courier");
        } else {
          search.set("courier", tab.key);
        }

        const href = search.size ? `/dashboard/orders?${search.toString()}` : "/dashboard/orders";
        const active = activeFilter === tab.key;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-3 text-[13px] font-medium transition ${active ? "border-[#7c3aed] text-[#6d3cf5]" : "border-transparent text-[#30313d] hover:text-[#6d3cf5]"}`}
            href={href}
            key={tab.key}
          >
            {tab.label}
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#f0f0f3] px-1.5 py-0.5 text-[10px] font-semibold text-[#555762]">
              {counts[tab.key]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
