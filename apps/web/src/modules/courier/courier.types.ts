/**
 * Provider-neutral courier vocabulary.
 *
 * Nothing here is carrier-specific: every provider adapter maps its own payloads
 * onto these types, so orders, shipments and UI never learn a carrier's dialect.
 */

export const courierProviderKeys = ["steadfast", "pathao", "redx", "paperfly", "carrybee"] as const;

export type CourierProviderKey = (typeof courierProviderKeys)[number];

/**
 * Internal delivery lifecycle. Carrier strings are translated into this enum by
 * each provider's status map, and the raw value is always stored alongside it so
 * an unmapped carrier state never loses information.
 */
export type ShipmentStatus =
  | "PENDING"
  | "REQUESTED"
  | "BOOKED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PARTIALLY_DELIVERED"
  | "RETURNED"
  | "CANCELLED"
  | "HOLD"
  | "LOST"
  | "FAILED"
  | "UNKNOWN";

/** Where a delivery event came from. */
export type DeliveryEventSource = "SYSTEM" | "MANUAL" | "PROVIDER_POLL" | "PROVIDER_WEBHOOK";

/** Statuses that will never change again without seller intervention. */
export const terminalShipmentStatuses: ShipmentStatus[] = [
  "DELIVERED",
  "PARTIALLY_DELIVERED",
  "RETURNED",
  "CANCELLED",
  "LOST"
];

export function isTerminalShipmentStatus(status: ShipmentStatus) {
  return terminalShipmentStatuses.includes(status);
}

/** A shipment in one of these states is worth polling for a status update. */
export function isActiveShipmentStatus(status: ShipmentStatus) {
  return !isTerminalShipmentStatus(status) && status !== "FAILED";
}
