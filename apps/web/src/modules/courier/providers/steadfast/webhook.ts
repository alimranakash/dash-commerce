import { safeEquals } from "../../courier-credentials";
import { parseCarrierTimestamp } from "../../courier-time";
import type {
  CourierWebhookAdapter,
  CourierWebhookEvent,
  CourierWebhookParseResult,
  CourierWebhookRequest
} from "../provider.types";
import { steadfastStatusToShipmentStatus } from "./status-map";

/**
 * Steadfast's merchant-panel webhook.
 *
 * Two notification types, and they are not the same shape of fact:
 *
 * - `delivery_status` carries a `delivery_status` value from a five-entry,
 *   title-cased vocabulary — a smaller and differently-cased set than the eleven
 *   the REST API returns. `status-map.ts` lowercases before lookup so one map
 *   serves both, and a poll and a webhook can never disagree.
 * - `tracking_update` carries free-text `tracking_message` and no status at all.
 *   Steadfast has no granular movement states, so this text is the only
 *   in-transit detail that exists. It is rendered verbatim and never parsed into
 *   a status — the event is emitted with no `status`, which makes the pipeline
 *   record a timeline entry at the current status instead of guessing.
 *
 * Auth is a Bearer token the merchant sets in their own panel, one per merchant
 * account. The payload carries no store identity whatsoever, which is why tenant
 * routing is the opaque token in the URL path and this is only the second
 * factor.
 */

type SteadfastWebhookPayload = {
  consignment_id?: number | string | null;
  delivery_status?: string | null;
  invoice?: string | null;
  notification_type?: string | null;
  status?: string | null;
  tracking_code?: string | null;
  tracking_message?: string | null;
  updated_at?: string | null;
};

export const steadfastWebhook: CourierWebhookAdapter = {
  parse,
  setupHint:
    "Steadfast merchant panel → Settings → Webhook. Paste the URL as the callback and the secret as the Bearer token, then save.",
  verify
};

function verify(request: CourierWebhookRequest, secret: string) {
  const header = request.headers.authorization ?? "";
  const bearer = /^bearer\s+(.+)$/i.exec(header.trim());
  const presented = (bearer?.[1] ?? header).trim();

  return presented.length > 0 && safeEquals(presented, secret);
}

function parse(request: CourierWebhookRequest): CourierWebhookParseResult {
  const payloads = toPayloadList(request.body);

  if (payloads.length === 0) {
    return { kind: "IGNORED", reason: "The payload carried no consignment." };
  }

  const events = payloads.flatMap((payload) => toEvent(payload) ?? []);

  if (events.length === 0) {
    return { kind: "IGNORED", reason: "No delivery update in this notification." };
  }

  return { events, kind: "EVENTS" };
}

/**
 * Steadfast documents a single object, but its bulk-order responses already
 * proved the API answers with a bare array in one place and `{ data: [...] }` in
 * another. Accepting all three costs nothing and makes a batched callback a
 * non-event.
 */
function toPayloadList(body: unknown): SteadfastWebhookPayload[] {
  if (Array.isArray(body)) {
    return body.filter(isRecord);
  }

  if (isRecord(body)) {
    const nested = (body as { data?: unknown }).data;

    if (Array.isArray(nested)) {
      return nested.filter(isRecord);
    }

    return [body];
  }

  return [];
}

function toEvent(payload: SteadfastWebhookPayload): CourierWebhookEvent | null {
  const reference = {
    consignmentId: text(payload.consignment_id),
    invoice: text(payload.invoice),
    trackingCode: text(payload.tracking_code)
  };

  if (!reference.consignmentId && !reference.invoice && !reference.trackingCode) {
    return null;
  }

  const occurredAt = parseCarrierTimestamp(payload.updated_at);
  const notification = text(payload.notification_type)?.toLowerCase() ?? null;
  const trackingMessage = text(payload.tracking_message);

  if (notification === "tracking_update" || (!payload.delivery_status && trackingMessage)) {
    return {
      message: trackingMessage,
      providerStatus: null,
      reference,
      ...(occurredAt ? { occurredAt } : {})
    };
  }

  // `status` is the transport-level "success"/200 field on REST responses, so it
  // is only trusted here as a fallback and only when it is not that.
  const providerStatus = text(payload.delivery_status) ?? deliveryStatusFallback(payload.status);

  if (!providerStatus) {
    return null;
  }

  return {
    message: trackingMessage ?? null,
    providerStatus,
    reference,
    status: steadfastStatusToShipmentStatus(providerStatus),
    ...(occurredAt ? { occurredAt } : {})
  };
}

function deliveryStatusFallback(value: unknown) {
  const status = text(value);

  if (!status || status === "200" || status.toLowerCase() === "success") {
    return null;
  }

  return status;
}

function text(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is SteadfastWebhookPayload {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
