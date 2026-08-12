import type { ShipmentStatus } from "../../courier.types";

/**
 * One map over both of Steadfast's status vocabularies.
 *
 * The REST API documents eleven `delivery_status` values; the webhook documents
 * a smaller five, differently cased (`"Delivered"` in the published example).
 * Keying on the lowercased value covers both, so a poll and a webhook can never
 * disagree about what a carrier string means.
 *
 * Steadfast reports no granular movement — there is no picked_up, in_transit,
 * out_for_delivery, returned or lost in its vocabulary. Those internal values
 * exist for other carriers; here the only genuine in-flight signals are
 * `in_review` and `pending`, and everything finer arrives as a free-text
 * tracking message that we render but never parse.
 */

const statusMap: Record<string, ShipmentStatus> = {
  cancelled: "CANCELLED",
  // "Waiting for admin approval" is not a settled state. Mapping the
  // approval-pending values to in-flight statuses is what stops an order being
  // marked fulfilled on a rider's unconfirmed claim, and what keeps COD
  // reconciliation honest — only the plain values mean the balance moved.
  cancelled_approval_pending: "IN_TRANSIT",
  delivered: "DELIVERED",
  delivered_approval_pending: "OUT_FOR_DELIVERY",
  hold: "HOLD",
  in_review: "BOOKED",
  partial_delivered: "PARTIALLY_DELIVERED",
  partial_delivered_approval_pending: "OUT_FOR_DELIVERY",
  pending: "IN_TRANSIT",
  unknown: "UNKNOWN",
  unknown_approval_pending: "UNKNOWN"
};

/**
 * Unmapped carrier strings become UNKNOWN. The raw value is always stored
 * alongside the mapped one, so an unrecognised state never loses information.
 */
export function steadfastStatusToShipmentStatus(value: string | null | undefined): ShipmentStatus {
  if (!value) {
    return "UNKNOWN";
  }

  return statusMap[value.trim().toLowerCase()] ?? "UNKNOWN";
}
