import {
  getCourierAccountsForStore,
  getDeliveryEventsForShipment,
  getShipmentsForOrder,
  getShipmentsForOrders
} from "./courier.repository";

/**
 * Courier orchestration layer.
 *
 * Phase 0 (this file today) exposes read-through helpers only — no provider
 * adapters exist yet and nothing here performs an external call.
 *
 * Landing later:
 *   Phase 1 — sendOrderToCourier(): credential resolution, idempotency guard,
 *             server-derived COD amount, provider.createShipment().
 *   Phase 2 — refreshShipmentStatus(): status mapping, delivery events, and the
 *             shipment -> Order.fulfillmentStatus projection.
 *   Phase 3 — getCourierBalance() and checkCustomerScore() with their caches.
 *   Phase 4 — sendOrdersToCourier(): the rate-limited bulk run.
 */

export async function listCourierAccounts(storeId: string) {
  return getCourierAccountsForStore(storeId);
}

export async function getOrderShipments(storeId: string, orderId: string) {
  return getShipmentsForOrder(storeId, orderId);
}

/** Used by the orders list to badge many rows from a single query. */
export async function getShipmentsByOrderId(storeId: string, orderIds: string[]) {
  const shipments = await getShipmentsForOrders(storeId, orderIds);

  return shipments.reduce<Map<string, (typeof shipments)[number]>>((map, shipment) => {
    if (!map.has(shipment.orderId)) {
      map.set(shipment.orderId, shipment);
    }

    return map;
  }, new Map());
}

export async function getShipmentTimeline(storeId: string, shipmentId: string) {
  return getDeliveryEventsForShipment(storeId, shipmentId);
}
