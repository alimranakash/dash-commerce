import { RadioTower } from "lucide-react";
import Link from "next/link";
import type { CourierAutoSyncView } from "../courier.service";

/**
 * A one-line answer to "is the Delivery column live?".
 *
 * The orders list already prints each parcel's carrier status; what it cannot
 * show is whether those values arrive on their own. Without that, a column full
 * of week-old statuses looks identical whether the parcels are stuck or the
 * webhook was never configured — so the chip is deliberately shown in both
 * states, not just the good one.
 */
export function CourierAutoSyncChip({ autoSync }: { autoSync: CourierAutoSyncView }) {
  if (!autoSync.enabled) {
    return (
      <Link
        className="inline-flex items-center gap-1.5 rounded-full border border-[#e4e3ee] bg-white px-3 py-1 text-[11px] font-medium text-[#777985] transition hover:border-[#bdb6da] hover:bg-[#faf9ff]"
        href="/dashboard/settings/courier"
        title="Delivery statuses only change when you press Refresh. Set up the courier webhook to keep them current."
      >
        <RadioTower className="h-3.5 w-3.5" />
        Auto-sync off
      </Link>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700"
      title={
        autoSync.lastSeenAt
          ? `Last courier update received ${formatDate(autoSync.lastSeenAt)}.`
          : "Waiting for the courier's first update."
      }
    >
      <RadioTower className="h-3.5 w-3.5" />
      Auto-sync on
    </span>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
