import { updateOrderFulfillmentStatusForStore, type FulfillmentStatus } from "../orders/order.repository";
import {
  createDeliveryEventForStore,
  getDeliveryEventsForShipment,
  getShipmentByIdForStore,
  updateShipmentForStore
} from "./courier.repository";
import { isTerminalShipmentStatus, type DeliveryEventSource, type ShipmentStatus } from "./courier.types";

/**
 * The single writer of Shipment.status.
 *
 * A manual refresh, a scheduled poll and (from Phase 6) an inbound webhook are
 * all just producers of a StatusUpdate; none of them touches the shipment row
 * directly. Keeping one writer is what lets the webhook receiver be additive
 * later instead of a rewrite of the poll path — and it means the ordering
 * guards below are enforced once rather than per caller.
 */

export type StatusUpdate = {
  /**
   * Set only when a booking call just succeeded. Carrying it here rather than in
   * a separate writer is what lets single send and bulk send settle through the
   * identical code path — the two cannot drift because there is only one.
   */
  booking?:
    | {
        labelUrl?: string | undefined;
        providerShipmentId: string | null;
        trackingCode: string | null;
      }
    | undefined;
  /** Absent for message-only events such as Steadfast's tracking_update. */
  status?: ShipmentStatus | undefined;
  message?: string | null | undefined;
  occurredAt?: Date | undefined;
  payload?: unknown;
  providerStatus?: string | null | undefined;
  shipmentId: string;
  source: DeliveryEventSource;
  storeId: string;
};

export type ApplyStatusResult = {
  changed: boolean;
  fulfillmentStatus: FulfillmentStatus | null;
  /** Set when a guard rejected the update, for logging and UI copy. */
  ignoredReason: string | null;
  providerStatus: string | null;
  status: ShipmentStatus;
};

export async function applyShipmentStatus(update: StatusUpdate): Promise<ApplyStatusResult> {
  const shipment = await getShipmentByIdForStore(update.storeId, update.shipmentId);

  if (!shipment) {
    throw new Error("Shipment not found for this store.");
  }

  const current = shipment.status as ShipmentStatus;
  const occurredAt = update.occurredAt ?? new Date();
  const next = update.status ?? current;
  const providerStatus = update.providerStatus ?? shipment.providerStatus ?? null;

  // Guard 1 — out-of-order delivery. Webhooks are not ordered, and a webhook can
  // race a poll covering the same transition, so an update that predates what we
  // already recorded is dropped rather than allowed to rewind the shipment.
  const [latest] = await getDeliveryEventsForShipment(update.storeId, shipment.id);

  if (latest && occurredAt.getTime() < latest.occurredAt.getTime()) {
    await touchSyncedAt(update.storeId, shipment.id);

    return ignored(current, providerStatus, "An older courier update arrived after a newer one.");
  }

  // Guard 2 — terminal states are final. Once a parcel is delivered, returned or
  // cancelled, a late in-flight update must not drag it back into transit.
  if (isTerminalShipmentStatus(current) && next !== current) {
    await touchSyncedAt(update.storeId, shipment.id);

    return ignored(current, providerStatus, `This shipment is already ${current.toLowerCase()}.`);
  }

  const statusChanged = next !== current;
  const providerStatusChanged = providerStatus !== shipment.providerStatus;
  const hasMessage = Boolean(update.message?.trim());

  await updateShipmentForStore(update.storeId, shipment.id, {
    lastSyncedAt: new Date(),
    providerStatus,
    status: next,
    ...(update.booking
      ? {
          bookedAt: shipment.bookedAt ?? occurredAt,
          lastError: null,
          providerShipmentId: update.booking.providerShipmentId,
          trackingCode: update.booking.trackingCode,
          ...(update.booking.labelUrl !== undefined ? { labelUrl: update.booking.labelUrl } : {})
        }
      : {}),
    ...(next === "DELIVERED" && !shipment.deliveredAt ? { deliveredAt: occurredAt } : {}),
    ...(next === "CANCELLED" && !shipment.cancelledAt ? { cancelledAt: occurredAt } : {}),
    ...(update.payload !== undefined ? { rawResponse: (update.payload ?? {}) as object } : {})
  });

  // An unchanged status writes no event, so the timeline stays meaningful. A
  // message-only update (tracking_update) still earns one at the current status.
  if (!statusChanged && !hasMessage && !providerStatusChanged && !update.booking) {
    return {
      changed: false,
      fulfillmentStatus: null,
      ignoredReason: null,
      providerStatus,
      status: current
    };
  }

  if (statusChanged || hasMessage || update.booking) {
    await createDeliveryEventForStore({
      message: update.message?.trim() || describe(next, providerStatus),
      occurredAt,
      providerStatus,
      shipmentId: shipment.id,
      source: update.source,
      status: next,
      storeId: update.storeId
    });
  }

  const fulfillmentStatus = statusChanged
    ? await projectFulfillment(update.storeId, shipment.orderId, next)
    : null;

  return { changed: statusChanged, fulfillmentStatus, ignoredReason: null, providerStatus, status: next };
}

/**
 * Shipment status → Order.fulfillmentStatus. One-directional and conservative:
 * the courier layer writes fulfillmentStatus and nothing else — never
 * Order.status, never paymentStatus, never an amount.
 *
 * Approval-pending carrier states deliberately do not reach FULFILLED. Steadfast
 * documents `delivered` as "delivered *and balance added*" while
 * `delivered_approval_pending` is only a rider's unconfirmed claim, so treating
 * them alike would mark orders complete on money that has not moved. The raw
 * carrier string is still displayed verbatim either way.
 */
export function fulfillmentStatusForShipment(status: ShipmentStatus): FulfillmentStatus | null {
  switch (status) {
    case "BOOKED":
    case "PICKED_UP":
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
      return "SHIPPED";
    case "DELIVERED":
      return "FULFILLED";
    case "PARTIALLY_DELIVERED":
      return "PARTIALLY_FULFILLED";
    case "RETURNED":
    case "CANCELLED":
      return "RETURNED";
    // PENDING, REQUESTED, FAILED, HOLD, LOST and UNKNOWN leave the order alone:
    // surface them in the UI, but never guess at fulfillment.
    default:
      return null;
  }
}

async function projectFulfillment(storeId: string, orderId: string, status: ShipmentStatus) {
  const fulfillmentStatus = fulfillmentStatusForShipment(status);

  if (!fulfillmentStatus) {
    return null;
  }

  await updateOrderFulfillmentStatusForStore(storeId, orderId, fulfillmentStatus);

  return fulfillmentStatus;
}

async function touchSyncedAt(storeId: string, shipmentId: string) {
  await updateShipmentForStore(storeId, shipmentId, { lastSyncedAt: new Date() });
}

function ignored(
  status: ShipmentStatus,
  providerStatus: string | null,
  reason: string
): ApplyStatusResult {
  return { changed: false, fulfillmentStatus: null, ignoredReason: reason, providerStatus, status };
}

function describe(status: ShipmentStatus, providerStatus: string | null) {
  return providerStatus ? `Courier status: ${providerStatus}` : `Status changed to ${status}.`;
}
