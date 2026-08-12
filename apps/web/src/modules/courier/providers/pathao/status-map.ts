import type { ShipmentStatus } from "../../courier.types";

/**
 * Pathao `order_status` / `order_status_slug` → our internal enum.
 *
 * The published documentation only ever shows `"Pending"`, so this map covers
 * that plus the slugs Pathao actually emits in the merchant panel. Keys are
 * normalized (lowercased, spaces and hyphens folded to underscores) so casing
 * and separator differences between the two fields cannot cause a miss, and
 * anything unrecognised becomes UNKNOWN with the raw string preserved.
 */

const statusMap: Record<string, ShipmentStatus> = {
  assigned_for_delivery: "OUT_FOR_DELIVERY",
  at_sorting_hub: "IN_TRANSIT",
  cancelled: "CANCELLED",
  delivered: "DELIVERED",
  delivery_failed: "FAILED",
  hold: "HOLD",
  in_transit: "IN_TRANSIT",
  lost: "LOST",
  on_hold: "HOLD",
  partial_delivery: "PARTIALLY_DELIVERED",
  partial_delivered: "PARTIALLY_DELIVERED",
  paid_return: "RETURNED",
  pending: "BOOKED",
  pickup_cancelled: "CANCELLED",
  pickup_failed: "FAILED",
  pickup_requested: "BOOKED",
  picked: "PICKED_UP",
  picked_up: "PICKED_UP",
  return: "RETURNED",
  returned: "RETURNED",
  exchange: "IN_TRANSIT"
};

export function pathaoStatusToShipmentStatus(value: string | null | undefined): ShipmentStatus {
  if (!value) {
    return "UNKNOWN";
  }

  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  return statusMap[key] ?? "UNKNOWN";
}
