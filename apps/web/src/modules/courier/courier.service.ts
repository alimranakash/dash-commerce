import { createHash } from "node:crypto";
import { createSystemLog } from "../../lib/system-log";
import { getOrderByIdForStore, getOrdersByIdsForStore } from "../orders/order.repository";
import { resolveCourierAccount, toCourierContext } from "./courier-accounts.service";
import { CourierError, courierErrorMessage, toCourierError } from "./courier-errors";
import { redactSecrets } from "./courier-http";
import { normalizeBangladeshPhone } from "./courier-phone";
import { assertCourierRateLimit } from "./courier-rate-limit";
import { applyShipmentStatus } from "./courier-status";
import { BULK_SEND_MAX_ORDERS } from "./courier.schema";
import {
  createDeliveryEventForStore,
  createShipmentForStore,
  getActiveShipmentsForStore,
  getCourierAccountForStore,
  getCourierAccountsForStore,
  getDeliveryEventsForShipment,
  getShipmentByIdForStore,
  getShipmentForOrderProvider,
  getShipmentsForOrder,
  getShipmentsForOrders,
  reserveShipmentsForStore,
  updateShipmentForStore
} from "./courier.repository";
import { requireCourierProvider } from "./providers/registry";
import { toSteadfastAddressLine } from "./providers/steadfast/mapper";
import type { CreateShipmentInput, CreateShipmentResult } from "./providers/provider.types";

/**
 * Courier orchestration.
 *
 * Landing later:
 *   Phase 3 — getCourierBalance() and checkCustomer() with their caches.
 *   Phase 4 — sendOrdersToCourier(): the native bulk run.
 *   Phase 6 — the webhook receiver, which produces the same StatusUpdate that
 *             refreshShipmentStatus() below does and shares applyShipmentStatus().
 */

type OrderForShipment = NonNullable<Awaited<ReturnType<typeof getOrderByIdForStore>>>;

export type SendOrderToCourierResult =
  | {
      kind: "SENT";
      provider: string;
      providerShipmentId: string | null;
      shipmentId: string;
      trackingCode: string | null;
    }
  | { kind: "SKIPPED"; message: string; shipmentId: string }
  | { kind: "FAILED"; message: string }
  /** The call timed out. A parcel may exist — resolve by refresh, never re-send. */
  | { kind: "UNRESOLVED"; message: string; shipmentId: string };

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

export type RefreshShipmentStatusResult = {
  kind: "FAILED" | "RECONCILED_MISSING" | "UNCHANGED" | "UPDATED";
  message: string;
};

/**
 * Pulls the current status from the carrier and hands it to the single writer.
 *
 * This is the recovery path for a booking that timed out, which is why it does
 * more than a plain status read: a shipment still sitting at REQUESTED with no
 * consignment id is reconciled by invoice to find out whether a parcel exists at
 * all. That question is the reason we never auto-retry create_order.
 */
export async function refreshShipmentStatus(input: {
  shipmentId: string;
  storeId: string;
  userId?: string | undefined;
}): Promise<RefreshShipmentStatusResult> {
  const shipment = await getShipmentByIdForStore(input.storeId, input.shipmentId);

  if (!shipment) {
    return { kind: "FAILED", message: "Shipment not found." };
  }

  try {
    const account = await getCourierAccountForStore(input.storeId, shipment.provider);

    if (!account?.credentialsCipher) {
      throw new CourierError("VALIDATION", "This courier is no longer configured for the store.");
    }

    const provider = requireCourierProvider(shipment.provider);

    assertCourierRateLimit(input.storeId, shipment.provider);

    const unresolvedBooking = shipment.status === "REQUESTED" && !shipment.providerShipmentId;

    try {
      const result = await provider.getStatus(
        {
          consignmentId: shipment.providerShipmentId,
          reference: shipment.invoiceReference,
          trackingCode: shipment.trackingCode
        },
        toCourierContext(input.storeId, account)
      );

      const applied = await applyShipmentStatus({
        payload: result.raw,
        providerStatus: result.providerStatus,
        shipmentId: shipment.id,
        source: "PROVIDER_POLL",
        status: result.status,
        storeId: input.storeId,
        ...(unresolvedBooking
          ? { message: `Reconciled after a timed-out booking — the courier reports "${result.providerStatus ?? result.status}".` }
          : {})
      });

      if (applied.ignoredReason) {
        return { kind: "UNCHANGED", message: applied.ignoredReason };
      }

      if (!applied.changed) {
        return {
          kind: "UNCHANGED",
          message: `No change — the courier still reports "${applied.providerStatus ?? applied.status}".`
        };
      }

      return {
        kind: "UPDATED",
        message: `Updated — the courier reports "${applied.providerStatus ?? applied.status}".`
      };
    } catch (error) {
      const courierError = toCourierError(error);

      // The one case where a not-found is good news: the booking timed out and
      // the carrier has no such invoice, so no parcel was created and the order
      // is safe to send again. Any other failure leaves the row untouched.
      if (unresolvedBooking && courierError.kind === "NOT_FOUND") {
        await applyShipmentStatus({
          message: "The courier has no record of this invoice, so no parcel was created. It is safe to send again.",
          shipmentId: shipment.id,
          source: "SYSTEM",
          status: "FAILED",
          storeId: input.storeId
        });

        await log(input, {
          level: "WARNING",
          message: `Timed-out courier booking reconciled as never created (invoice ${shipment.invoiceReference}).`,
          metadata: { invoiceReference: shipment.invoiceReference, provider: shipment.provider }
        });

        return {
          kind: "RECONCILED_MISSING",
          message: "No parcel was created for this order. You can send it again."
        };
      }

      throw courierError;
    }
  } catch (error) {
    const courierError = toCourierError(error);

    // A failed read never changes stored status — it only records that we tried.
    await updateShipmentForStore(input.storeId, shipment.id, {
      lastError: courierErrorMessage(courierError),
      lastSyncedAt: new Date()
    });

    return { kind: "FAILED", message: courierErrorMessage(courierError) };
  }
}

/**
 * Books one order with one carrier.
 *
 * The ordering is the safety design: the shipment row is written as REQUESTED
 * *before* the HTTP call, so the `(storeId, orderId, provider)` unique
 * constraint fires on our side while nothing has been booked yet. A double
 * click, a concurrent bulk run, and a retried form post all collide here rather
 * than at the carrier.
 *
 * There is no automatic retry on create_order — a retried booking is a second
 * real parcel. A timeout therefore leaves the row REQUESTED and is resolved by
 * a status refresh (Phase 2), never by sending again.
 */
export async function sendOrderToCourier(input: {
  orderId: string;
  provider?: string | undefined;
  storeId: string;
  userId?: string | undefined;
}): Promise<SendOrderToCourierResult> {
  const order = await getOrderByIdForStore(input.storeId, input.orderId);

  if (!order) {
    return { kind: "FAILED", message: "Order not found." };
  }

  let providerKey = input.provider ?? "";

  try {
    const account = await resolveCourierAccount(input.storeId, input.provider);

    providerKey = account.provider;

    const provider = requireCourierProvider(account.provider);
    const existing = await getShipmentForOrderProvider(input.storeId, order.id, account.provider);

    if (existing && existing.status !== "FAILED") {
      return {
        kind: "SKIPPED",
        message:
          existing.status === "REQUESTED"
            ? `Already sent to ${provider.label} and awaiting confirmation. Refresh the status before sending again.`
            : `Already booked with ${provider.label}.`,
        shipmentId: existing.id
      };
    }

    assertCourierRateLimit(input.storeId, account.provider);

    const draft = buildShipmentDraft(order);
    const requestHash = hashDraft(draft);

    const shipment = existing
      ? existing
      : await createShipmentForStore({
          codAmount: draft.codAmount,
          courierAccountId: account.id,
          createdByUserId: input.userId ?? null,
          invoiceReference: draft.reference,
          orderId: order.id,
          provider: account.provider,
          requestHash,
          status: "REQUESTED",
          storeId: input.storeId
        });

    if (existing) {
      await updateShipmentForStore(input.storeId, shipment.id, {
        attemptCount: existing.attemptCount + 1,
        courierAccountId: account.id,
        lastError: null,
        requestHash,
        status: "REQUESTED"
      });
    }

    await createDeliveryEventForStore({
      message: `Booking requested with ${provider.label}.`,
      shipmentId: shipment.id,
      source: "MANUAL",
      status: "REQUESTED",
      storeId: input.storeId
    });

    try {
      const result = await provider.createShipment(draft, toCourierContext(input.storeId, account));

      // Settled through the same writer bulk uses, so the two cannot diverge.
      await settleBooking(input.storeId, shipment.id, result);

      await log(input, {
        level: "INFO",
        message: `Courier booking created with ${provider.label} for order ${order.orderNumber}.`,
        metadata: {
          codAmount: draft.codAmount,
          consignmentId: result.providerShipmentId,
          orderNumber: order.orderNumber,
          provider: account.provider,
          trackingCode: result.trackingCode
        }
      });

      return {
        kind: "SENT",
        provider: account.provider,
        providerShipmentId: result.providerShipmentId,
        shipmentId: shipment.id,
        trackingCode: result.trackingCode
      };
    } catch (error) {
      return settleFailure({
        error,
        input,
        orderNumber: order.orderNumber,
        providerKey: account.provider,
        shipmentId: shipment.id
      });
    }
  } catch (error) {
    const courierError = toCourierError(error);

    await log(input, {
      level: "ERROR",
      message: `Courier booking could not start for order ${order.orderNumber}: ${courierError.message}`,
      metadata: { kind: courierError.kind, orderNumber: order.orderNumber, provider: providerKey }
    });

    return { kind: "FAILED", message: courierErrorMessage(courierError) };
  }
}

async function settleFailure(args: {
  error: unknown;
  input: { orderId: string; storeId: string; userId?: string | undefined };
  orderNumber: string;
  providerKey: string;
  shipmentId: string;
}): Promise<SendOrderToCourierResult> {
  const courierError = toCourierError(args.error);
  const message = courierErrorMessage(courierError);
  const unresolved = courierError.kind === "TIMEOUT";

  await updateShipmentForStore(args.input.storeId, args.shipmentId, {
    lastError: message,
    lastSyncedAt: new Date(),
    // A timeout must NOT become FAILED: the parcel may exist. Leaving the row
    // REQUESTED is what keeps the idempotency guard closed until a refresh
    // reconciles it by invoice.
    ...(unresolved ? {} : { status: "FAILED" as const })
  });

  await createDeliveryEventForStore({
    message,
    shipmentId: args.shipmentId,
    source: "SYSTEM",
    status: unresolved ? "REQUESTED" : "FAILED",
    storeId: args.input.storeId
  });

  await log(args.input, {
    level: unresolved ? "WARNING" : "ERROR",
    message: `Courier booking ${unresolved ? "timed out" : "failed"} for order ${args.orderNumber}: ${courierError.message}`,
    metadata: { kind: courierError.kind, orderNumber: args.orderNumber, provider: args.providerKey }
  });

  return unresolved
    ? { kind: "UNRESOLVED", message, shipmentId: args.shipmentId }
    : { kind: "FAILED", message };
}

/* -------------------------------------------------------------------------- */
/* Bulk send                                                                  */
/* -------------------------------------------------------------------------- */

export type BulkSendResult = {
  failed: Array<{ message: string; orderNumber: string }>;
  /** Booked or possibly booked, but not confirmable — never re-send these. */
  needsReconciliation: Array<{ message: string; orderNumber: string }>;
  provider: string;
  providerLabel: string;
  sent: Array<{ orderNumber: string; trackingCode: string | null }>;
  skipped: Array<{ orderNumber: string; reason: string }>;
};

/**
 * Books many orders with one carrier, using its native bulk endpoint.
 *
 * The ordering is the whole safety design, and it is the same shape as single
 * send — filter, validate, reserve, dispatch, settle:
 *
 *   1. Skip orders that already have a non-failed shipment for this provider.
 *   2. Build and validate every draft *before* anything is dispatched, so a bad
 *      phone or address costs no API call and is discovered here rather than in
 *      a per-item response after the parcels exist.
 *   3. Reserve all rows as REQUESTED in one transaction, so the unique
 *      constraint fires on our side while nothing has been booked.
 *   4. One call per chunk.
 *   5. Settle each row independently through applyShipmentStatus.
 *
 * On a timeout or 5xx the batch is NOT retried and NOT looped: up to N real
 * parcels may exist. Those rows are swept by invoice instead, which is the only
 * way to learn what was actually created.
 */
export async function sendOrdersToCourier(input: {
  orderIds: string[];
  provider?: string | undefined;
  storeId: string;
  userId?: string | undefined;
}): Promise<BulkSendResult> {
  const account = await resolveCourierAccount(input.storeId, input.provider);
  const provider = requireCourierProvider(account.provider);
  const result: BulkSendResult = {
    failed: [],
    needsReconciliation: [],
    provider: account.provider,
    providerLabel: provider.label,
    sent: [],
    skipped: []
  };

  const orderIds = input.orderIds.slice(0, BULK_SEND_MAX_ORDERS);
  const orders = await getOrdersByIdsForStore(input.storeId, orderIds);
  const existing = await getShipmentsForOrders(input.storeId, orderIds);
  const existingByOrder = new Map(
    existing.filter((shipment) => shipment.provider === account.provider).map((s) => [s.orderId, s])
  );

  // 1 · Filter — already sent, and orders that do not belong to this store.
  const candidates = orders.filter((order) => {
    const shipment = existingByOrder.get(order.id);

    if (shipment && shipment.status !== "FAILED") {
      result.skipped.push({
        orderNumber: order.orderNumber,
        reason: shipment.status === "REQUESTED" ? "Awaiting confirmation from a previous send." : `Already booked with ${provider.label}.`
      });

      return false;
    }

    return true;
  });

  // 2 · Validate every draft before any dispatch.
  const drafts: Array<{ draft: CreateShipmentInput; order: (typeof orders)[number] }> = [];

  for (const order of candidates) {
    try {
      drafts.push({ draft: buildShipmentDraft(order), order });
    } catch (error) {
      result.failed.push({
        message: courierErrorMessage(toCourierError(error)),
        orderNumber: order.orderNumber
      });
    }
  }

  if (drafts.length === 0) {
    return result;
  }

  assertCourierRateLimit(input.storeId, account.provider, Math.ceil(drafts.length / 10));

  // 3 · Reserve every row before the carrier is told anything.
  const reuse = new Map(
    drafts
      .filter(({ order }) => existingByOrder.has(order.id))
      .map(({ order }) => {
        const shipment = existingByOrder.get(order.id);

        return [order.id, { attemptCount: shipment?.attemptCount ?? 0, id: shipment?.id ?? "" }];
      })
  );

  const hashByOrder = new Map(drafts.map(({ draft, order }) => [order.id, hashDraft(draft)]));
  const reserved = await reserveShipmentsForStore({
    courierAccountId: account.id,
    createdByUserId: input.userId ?? null,
    drafts: drafts.map(({ draft, order }) => ({
      codAmount: draft.codAmount,
      invoiceReference: draft.reference,
      orderId: order.id,
      requestHash: hashByOrder.get(order.id) ?? hashDraft(draft)
    })),
    provider: account.provider,
    reuseShipmentIds: reuse,
    storeId: input.storeId
  });

  // A row whose hash is not ours was reserved by a concurrent run between our
  // filter and our insert — `skipDuplicates` let it survive, so it is theirs to
  // dispatch, not ours. Claiming it would book the same parcel twice.
  const shipmentByOrder = new Map(
    reserved
      .filter((shipment) => shipment.requestHash === hashByOrder.get(shipment.orderId))
      .map((shipment) => [shipment.orderId, shipment])
  );

  for (const { order } of drafts) {
    const shipment = shipmentByOrder.get(order.id);

    if (!shipment) {
      result.skipped.push({
        orderNumber: order.orderNumber,
        reason: "Another send for this order was already in progress."
      });

      continue;
    }

    await createDeliveryEventForStore({
      message: `Booking requested with ${provider.label} (bulk).`,
      shipmentId: shipment.id,
      source: "MANUAL",
      status: "REQUESTED",
      storeId: input.storeId
    });
  }

  // 4 · Dispatch, chunked against the carrier's own ceiling.
  const chunkSize = Math.min(
    BULK_SEND_MAX_ORDERS,
    provider.capabilities.bulkMaxBatchSize ?? BULK_SEND_MAX_ORDERS
  );
  const context = toCourierContext(input.storeId, account);

  const dispatchable = drafts.filter(({ order }) => shipmentByOrder.has(order.id));

  for (let index = 0; index < dispatchable.length; index += chunkSize) {
    const chunk = dispatchable.slice(index, index + chunkSize);

    await dispatchChunk({ account, chunk, context, provider, result, shipmentByOrder, storeId: input.storeId });
  }

  await log(input, {
    level: "INFO",
    message: `Bulk courier send with ${provider.label}: ${result.sent.length} sent, ${result.skipped.length} skipped, ${result.failed.length} failed.`,
    metadata: {
      failed: result.failed.length,
      needsReconciliation: result.needsReconciliation.length,
      provider: account.provider,
      sent: result.sent.length,
      skipped: result.skipped.length
    }
  });

  return result;
}

type DispatchArgs = {
  account: { credentialsCipher: string | null; credentialsPublic: unknown; id: string; provider: string };
  chunk: Array<{ draft: CreateShipmentInput; order: { id: string; orderNumber: string } }>;
  context: ReturnType<typeof toCourierContext>;
  provider: ReturnType<typeof requireCourierProvider>;
  result: BulkSendResult;
  shipmentByOrder: Map<string, { id: string }>;
  storeId: string;
};

async function dispatchChunk(args: DispatchArgs) {
  const { chunk, provider, result, shipmentByOrder, storeId } = args;
  const useNativeBulk = provider.capabilities.nativeBulk && provider.createShipments;

  try {
    if (useNativeBulk && provider.createShipments) {
      const bulk = await provider.createShipments(chunk.map((entry) => entry.draft), args.context);
      const byReference = new Map(bulk.results.map((item) => [item.reference, item]));

      for (const { draft, order } of chunk) {
        const shipment = shipmentByOrder.get(order.id);
        const item = byReference.get(draft.reference);

        if (!shipment || !item) {
          result.needsReconciliation.push({
            message: "No matching result came back — check this order with the courier before re-sending.",
            orderNumber: order.orderNumber
          });

          continue;
        }

        if (item.outcome === "SUCCESS") {
          await settleBooking(storeId, shipment.id, item.result);
          result.sent.push({ orderNumber: order.orderNumber, trackingCode: item.result.trackingCode });

          continue;
        }

        if (item.outcome === "UNMATCHED") {
          // The carrier answered, but not about something we can attribute.
          // Reconcile by invoice rather than guessing either way.
          await reconcileByInvoice(storeId, shipment.id, order.orderNumber, result);

          continue;
        }

        await failShipment(storeId, shipment.id, item.message);
        result.failed.push({ message: item.message, orderNumber: order.orderNumber });
      }

      return;
    }

    // No native bulk: sequential single sends, which are individually safe.
    for (const { draft, order } of chunk) {
      const shipment = shipmentByOrder.get(order.id);

      if (!shipment) {
        continue;
      }

      try {
        const single = await provider.createShipment(draft, args.context);

        await settleBooking(storeId, shipment.id, single);
        result.sent.push({ orderNumber: order.orderNumber, trackingCode: single.trackingCode });
      } catch (error) {
        await settleChunkFailure(storeId, [{ order }], toCourierError(error), result, shipmentByOrder);
      }
    }
  } catch (error) {
    await settleChunkFailure(storeId, chunk, toCourierError(error), result, shipmentByOrder);
  }
}

/**
 * How a whole-chunk failure is resolved — and the single most important rule in
 * this phase.
 *
 * A timeout or a 5xx means the request may well have reached the carrier, so up
 * to a chunk's worth of real parcels may now exist. Re-sending would duplicate
 * every one of them, so those rows are swept by invoice instead. Only a provable
 * no-reach failure — connection refused, or a whole-batch 4xx the carrier
 * rejected outright — is safe to mark as never-sent.
 */
async function settleChunkFailure(
  storeId: string,
  chunk: Array<{ order: { id: string; orderNumber: string } }>,
  error: CourierError,
  result: BulkSendResult,
  shipmentByOrder: Map<string, { id: string }>
) {
  const provablyNotSent =
    error.kind === "AUTH" || error.kind === "VALIDATION" || error.kind === "RATE_LIMIT";
  const message = courierErrorMessage(error);

  for (const { order } of chunk) {
    const shipment = shipmentByOrder.get(order.id);

    if (!shipment) {
      continue;
    }

    if (provablyNotSent) {
      await failShipment(storeId, shipment.id, message);
      result.failed.push({ message, orderNumber: order.orderNumber });

      continue;
    }

    await reconcileByInvoice(storeId, shipment.id, order.orderNumber, result);
  }
}

/** Discovers what the carrier actually created. Never re-sends. */
async function reconcileByInvoice(
  storeId: string,
  shipmentId: string,
  orderNumber: string,
  result: BulkSendResult
) {
  const swept = await refreshShipmentStatus({ shipmentId, storeId });

  if (swept.kind === "RECONCILED_MISSING") {
    result.failed.push({
      message: "No parcel was created for this order — it is safe to send again.",
      orderNumber
    });

    return;
  }

  result.needsReconciliation.push({ message: swept.message, orderNumber });
}

async function settleBooking(
  storeId: string,
  shipmentId: string,
  booking: CreateShipmentResult
) {
  await applyShipmentStatus({
    booking: {
      providerShipmentId: booking.providerShipmentId,
      trackingCode: booking.trackingCode,
      ...(booking.labelUrl !== undefined ? { labelUrl: booking.labelUrl } : {})
    },
    message: booking.providerShipmentId
      ? `Booking confirmed — consignment ${booking.providerShipmentId}.`
      : "Booking confirmed.",
    payload: redactSecrets(booking.raw),
    providerStatus: booking.providerStatus,
    shipmentId,
    source: "SYSTEM",
    status: booking.status,
    storeId
  });
}

async function failShipment(storeId: string, shipmentId: string, message: string) {
  await updateShipmentForStore(storeId, shipmentId, {
    lastError: message,
    lastSyncedAt: new Date(),
    status: "FAILED"
  });

  await createDeliveryEventForStore({
    message,
    shipmentId,
    source: "SYSTEM",
    status: "FAILED",
    storeId
  });
}

/** Sweeps every non-terminal shipment. Reads only — nothing here books. */
export async function refreshActiveShipments(storeId: string) {
  const active = await getActiveShipmentsForStore(storeId);
  let updated = 0;
  let failed = 0;

  for (const shipment of active) {
    const result = await refreshShipmentStatus({ shipmentId: shipment.id, storeId });

    if (result.kind === "UPDATED") {
      updated += 1;
    } else if (result.kind === "FAILED") {
      failed += 1;
    }
  }

  return { checked: active.length, failed, updated };
}

/**
 * Builds the carrier-neutral draft entirely from the stored order. No value here
 * comes from the client — in particular the COD amount, which is a real cash
 * instruction to a courier.
 */
function buildShipmentDraft(order: OrderForShipment): CreateShipmentInput {
  const address = order.shippingAddress;
  const primaryPhone =
    normalizeBangladeshPhone(order.customerPhone) ?? normalizeBangladeshPhone(address?.phone);

  if (!primaryPhone) {
    throw new CourierError(
      "VALIDATION",
      `"${order.customerPhone}" is not a valid Bangladeshi mobile number, so this order cannot be booked. Fix the customer's phone number first.`
    );
  }

  const alternatePhone = normalizeBangladeshPhone(address?.phone);
  const addressLine = toSteadfastAddressLine([
    address?.addressLine1,
    address?.addressLine2,
    address?.area ?? order.shippingArea,
    address?.city ?? order.shippingCity,
    address?.district ?? order.shippingDistrict,
    address?.postalCode
  ]);

  if (!addressLine) {
    throw new CourierError("VALIDATION", "This order has no shipping address to send to the courier.");
  }

  const quantity = order.items.reduce((total, item) => total + item.quantity, 0);
  const email = order.customerEmail?.trim() || address?.email?.trim() || "";
  const note = order.notes?.trim() || "";
  const itemDescription = order.items
    .map((item) => `${item.quantity}× ${item.title}`)
    .join(", ");

  return {
    // Derived server-side, always: zero when the order is already paid, so a
    // prepaid parcel is never collected on a second time.
    codAmount: order.paymentStatus === "PAID" ? 0 : Number(order.totalAmount),
    deliveryType: "HOME",
    reference: order.orderNumber,
    recipient: {
      address: addressLine,
      name: (address?.name?.trim() || order.customerName).trim(),
      phone: primaryPhone,
      // Optional fields are dropped rather than allowed to fail a booking.
      ...(alternatePhone && alternatePhone !== primaryPhone ? { alternatePhone } : {}),
      ...(email ? { email } : {}),
      ...(address?.area ? { area: address.area } : {}),
      ...(address?.city ? { city: address.city } : {}),
      ...(address?.district ? { district: address.district } : {}),
      ...(address?.postalCode ? { postalCode: address.postalCode } : {})
    },
    ...(itemDescription ? { itemDescription } : {}),
    ...(note ? { note } : {}),
    ...(quantity > 0 ? { quantity } : {})
  };
}

function hashDraft(draft: CreateShipmentInput) {
  return createHash("sha256").update(JSON.stringify(draft)).digest("hex");
}

async function log(
  input: { storeId: string; userId?: string | undefined },
  entry: { level: "ERROR" | "INFO" | "WARNING"; message: string; metadata: Record<string, unknown> }
) {
  await createSystemLog({
    level: entry.level,
    message: entry.message,
    metadata: entry.metadata as never,
    source: "ORDER",
    storeId: input.storeId,
    ...(input.userId ? { userId: input.userId } : {})
  });
}
