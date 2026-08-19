import { safeEquals } from "../../courier-credentials";
import { parseCarrierTimestamp } from "../../courier-time";
import type { ShipmentStatus } from "../../courier.types";
import type {
  CourierWebhookAdapter,
  CourierWebhookEvent,
  CourierWebhookParseResult,
  CourierWebhookRequest
} from "../provider.types";
import { pathaoStatusToShipmentStatus } from "./status-map";

/**
 * Pathao's merchant webhook.
 *
 * Three carrier-specific facts live here and nowhere else:
 *
 * 1. Auth is the `X-PATHAO-Signature` header carrying the webhook secret the
 *    merchant configured — not a Bearer, and not a computed HMAC.
 * 2. Pathao expects the receiver to echo a fixed handshake value back on every
 *    accepted callback, otherwise it treats the endpoint as unverified and stops
 *    sending. That constant is Pathao's, identical for every merchant.
 * 3. The status of record is the `event` name (`order.delivered`), not the
 *    display string. `order_status` is a human label that changes wording; the
 *    event name does not, so it is read first and the label is only a fallback
 *    through the shared status map.
 *
 * Unlike Steadfast, Pathao can only ever be matched by consignment id — there is
 * no lookup by `merchant_order_id`, which is also why its bulk endpoint is
 * unused.
 */

const PATHAO_ACK_HEADER = "X-Pathao-Merchant-Webhook-Integration-Secret";
const PATHAO_ACK_VALUE = "f3992ab6-96ec-4e5c-b0b6-27d99e5d5d5f";

type PathaoWebhookPayload = {
  consignment_id?: string | null;
  event?: string | null;
  merchant_order_id?: string | null;
  order_status?: string | null;
  reason?: string | null;
  timestamp?: string | null;
  updated_at?: string | null;
};

/**
 * Event name → internal status. Kept separate from `status-map.ts` because the
 * two vocabularies are genuinely different: that map keys on `order_status`
 * slugs, this one on the `order.*` event names, and Pathao does not guarantee
 * they stay in step.
 */
const eventStatusMap: Record<string, ShipmentStatus> = {
  "at-sorting-hub": "IN_TRANSIT",
  "delivered": "DELIVERED",
  "delivery-failed": "FAILED",
  "in-transit": "IN_TRANSIT",
  "on-hold": "HOLD",
  "partial-delivery": "PARTIALLY_DELIVERED",
  "pickup": "PICKED_UP",
  "pickup-cancelled": "CANCELLED",
  "pickup-failed": "FAILED",
  "pickup-requested": "BOOKED",
  "received-at-last-mile-hub": "IN_TRANSIT",
  "returned": "RETURNED"
};

/** Lifecycle noise that names no delivery progress. */
const ignoredEvents = new Set(["order.created", "order.updated", "webhook.integration"]);

export const pathaoWebhook: CourierWebhookAdapter = {
  ackHeaders: { [PATHAO_ACK_HEADER]: PATHAO_ACK_VALUE },
  parse,
  setupHint:
    "Pathao merchant panel → Developer API → Webhook. Paste the URL, set the secret as the webhook secret, then send a test to verify.",
  verify
};

function verify(request: CourierWebhookRequest, secret: string) {
  const presented = (
    request.headers["x-pathao-signature"] ??
    request.headers["x-pathao-merchant-webhook-integration-secret"] ??
    ""
  ).trim();

  return presented.length > 0 && safeEquals(presented, secret);
}

function parse(request: CourierWebhookRequest): CourierWebhookParseResult {
  if (!isRecord(request.body)) {
    return { kind: "IGNORED", reason: "The payload was not a Pathao event object." };
  }

  const payload = request.body;
  const event = text(payload.event)?.toLowerCase() ?? null;

  if (event && ignoredEvents.has(event)) {
    return { kind: "IGNORED", reason: `Pathao "${event}" carries no delivery progress.` };
  }

  const consignmentId = text(payload.consignment_id);

  if (!consignmentId) {
    return { kind: "IGNORED", reason: "The payload carried no consignment id." };
  }

  const orderStatus = text(payload.order_status);
  const status = statusForEvent(event) ?? pathaoStatusToShipmentStatus(orderStatus);

  if (status === "UNKNOWN" && !orderStatus && !event) {
    return { kind: "IGNORED", reason: "No delivery update in this notification." };
  }

  const occurredAt = parseCarrierTimestamp(payload.updated_at ?? payload.timestamp);
  const events: CourierWebhookEvent[] = [
    {
      // Pathao's `reason` is the only free text it sends — a failure or hold
      // explanation the seller genuinely needs.
      message: text(payload.reason),
      // Displayed verbatim, so prefer Pathao's own label and fall back to the
      // event name rather than showing our internal enum as if it were theirs.
      providerStatus: orderStatus ?? event ?? null,
      reference: { consignmentId },
      status,
      ...(occurredAt ? { occurredAt } : {})
    }
  ];

  return { events, kind: "EVENTS" };
}

function statusForEvent(event: string | null) {
  if (!event) {
    return null;
  }

  const key = event.replace(/^order\./, "").replace(/[\s_]+/g, "-");

  return eventStatusMap[key] ?? null;
}

function text(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is PathaoWebhookPayload {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
