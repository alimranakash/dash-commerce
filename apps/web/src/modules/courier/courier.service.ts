import { createHash } from "node:crypto";
import { createSystemLog } from "../../lib/system-log";
import { getOrderByIdForStore } from "../orders/order.repository";
import { resolveCourierAccount, toCourierContext } from "./courier-accounts.service";
import { CourierError, courierErrorMessage, toCourierError } from "./courier-errors";
import { redactSecrets } from "./courier-http";
import { normalizeBangladeshPhone } from "./courier-phone";
import { assertCourierRateLimit } from "./courier-rate-limit";
import { applyShipmentStatus } from "./courier-status";
import {
  createDeliveryEventForStore,
  createShipmentForStore,
  getCourierAccountForStore,
  getCourierAccountsForStore,
  getDeliveryEventsForShipment,
  getShipmentByIdForStore,
  getShipmentForOrderProvider,
  getShipmentsForOrder,
  getShipmentsForOrders,
  updateShipmentForStore
} from "./courier.repository";
import { requireCourierProvider } from "./providers/registry";
import { toSteadfastAddressLine } from "./providers/steadfast/mapper";
import type { CreateShipmentInput } from "./providers/provider.types";

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

      await updateShipmentForStore(input.storeId, shipment.id, {
        bookedAt: new Date(),
        lastError: null,
        lastSyncedAt: new Date(),
        providerShipmentId: result.providerShipmentId,
        providerStatus: result.providerStatus,
        rawResponse: (redactSecrets(result.raw) ?? {}) as object,
        status: result.status,
        trackingCode: result.trackingCode,
        ...(result.labelUrl !== undefined ? { labelUrl: result.labelUrl } : {})
      });

      await createDeliveryEventForStore({
        message: result.providerShipmentId
          ? `Booking confirmed — consignment ${result.providerShipmentId}.`
          : "Booking confirmed.",
        providerStatus: result.providerStatus,
        shipmentId: shipment.id,
        source: "SYSTEM",
        status: result.status,
        storeId: input.storeId
      });

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
