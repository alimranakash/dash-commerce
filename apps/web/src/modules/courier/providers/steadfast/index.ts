import { CourierError } from "../../courier-errors";
import { redactSecrets } from "../../courier-http";
import type {
  BalanceResult,
  CourierContext,
  CourierProvider,
  CreateShipmentInput,
  CreateShipmentResult,
  CustomerScoreResult,
  GetStatusInput,
  ShipmentStatusResult
} from "../provider.types";
import { steadfastDefaultBaseUrl, steadfastRequest } from "./client";
import { toSteadfastCreateOrderPayload } from "./mapper";
import { steadfastStatusToShipmentStatus } from "./status-map";

/**
 * Steadfast (Packzy), the first real provider.
 *
 * Capabilities below describe the official API v1 surface. `customerScore` is
 * the one flag not backed by the published documentation — `/fraud_check` is
 * undocumented but works in practice, so it is declared here and its adapter
 * method lands with Phase 3, failing gracefully where an account lacks it.
 */

type CreateOrderResponse = {
  consignment?: {
    consignment_id?: number | string | null;
    invoice?: string | null;
    status?: string | null;
    tracking_code?: string | null;
  } | null;
  message?: string;
  status?: number;
};

type BalanceResponse = {
  current_balance?: number | string | null;
  status?: number;
};

type StatusResponse = {
  delivery_status?: string | null;
  status?: number;
};

export const steadfastProvider: CourierProvider = {
  capabilities: {
    balance: true,
    // The carrier ceiling for /create_order/bulk-order. Our own send cap is
    // lower on purpose and lives in courier.schema.ts.
    bulkMaxBatchSize: 500,
    cancel: false,
    customerScore: true,
    label: false,
    nativeBulk: true,
    payouts: true,
    returnRequest: true,
    serviceAreas: true,
    statusLookupKeys: ["consignmentId", "invoice", "trackingCode"],
    webhook: true
  },
  createShipment,
  credentialFields: [
    {
      defaultValue: steadfastDefaultBaseUrl,
      helpText: "Leave as-is unless Steadfast gave you a different endpoint.",
      label: "API Base URL",
      name: "baseUrl",
      placeholder: steadfastDefaultBaseUrl,
      required: false,
      secret: false,
      type: "url"
    },
    {
      label: "API Key",
      name: "apiKey",
      placeholder: "Provided by Steadfast",
      required: true,
      secret: true
    },
    {
      label: "Secret Key",
      name: "secretKey",
      placeholder: "Provided by Steadfast",
      required: true,
      secret: true
    }
  ],
  checkCustomer,
  getBalance,
  getStatus,
  key: "steadfast",
  label: "Steadfast",
  testConnection
};

async function createShipment(
  input: CreateShipmentInput,
  context: CourierContext
): Promise<CreateShipmentResult> {
  const payload = toSteadfastCreateOrderPayload(input);

  // No retry, ever: a retried create_order is a second real parcel.
  const data = await steadfastRequest<CreateOrderResponse>(context, {
    body: payload,
    method: "POST",
    path: "/create_order"
  });

  const consignment = data.consignment ?? null;

  if (!consignment) {
    throw new CourierError("UNKNOWN", data.message?.trim() || "The courier did not return a consignment.");
  }

  const providerStatus = consignment.status?.trim() || null;

  return {
    providerShipmentId: toNullableString(consignment.consignment_id),
    providerStatus,
    raw: redactSecrets(data),
    // A booking that came back with a consignment id is booked, whatever the
    // carrier's own review state says.
    status: providerStatus ? steadfastStatusToShipmentStatus(providerStatus) : "BOOKED",
    trackingCode: toNullableString(consignment.tracking_code)
  };
}

/**
 * All three documented lookups, tried in order of reliability.
 *
 * The consignment id is the carrier's own key so it goes first. Invoice is the
 * fallback that makes a timed-out booking recoverable — it is the only key we
 * are guaranteed to hold even when the create call never returned. Note the
 * response carries `delivery_status` and nothing else: no timestamp, no charge,
 * no consignment id, so a poll can never backfill codes we failed to capture.
 */
async function getStatus(
  input: GetStatusInput,
  context: CourierContext
): Promise<ShipmentStatusResult> {
  const lookups = [
    input.consignmentId ? `/status_by_cid/${encodeURIComponent(input.consignmentId)}` : null,
    input.reference ? `/status_by_invoice/${encodeURIComponent(input.reference)}` : null,
    input.trackingCode ? `/status_by_trackingcode/${encodeURIComponent(input.trackingCode)}` : null
  ].filter((path): path is string => path !== null);

  if (lookups.length === 0) {
    throw new CourierError("VALIDATION", "No consignment id, invoice or tracking code to look up.");
  }

  let lastError: unknown = null;

  for (const path of lookups) {
    try {
      // Idempotent read, so one retry is safe here.
      const data = await steadfastRequest<StatusResponse>(context, {
        method: "GET",
        path,
        retry: true
      });
      const providerStatus = data.delivery_status?.trim() || null;

      return {
        providerStatus,
        raw: redactSecrets(data),
        status: steadfastStatusToShipmentStatus(providerStatus)
      };
    } catch (error) {
      lastError = error;

      // Only keep trying other keys when this one simply isn't known to the
      // carrier. An auth or outage failure will fail identically on the rest.
      if (!(error instanceof CourierError) || error.kind !== "NOT_FOUND") {
        throw error;
      }
    }
  }

  throw lastError instanceof CourierError
    ? lastError
    : new CourierError("NOT_FOUND", "The courier has no record of this consignment.");
}

async function getBalance(context: CourierContext): Promise<BalanceResult> {
  const data = await steadfastRequest<BalanceResponse>(context, {
    method: "GET",
    path: "/get_balance",
    retry: true
  });
  const amount = Number(data.current_balance ?? 0);

  return { amount: Number.isFinite(amount) ? amount : 0, currency: "BDT" };
}

/**
 * The customer delivery-history check.
 *
 * `/fraud_check/{phone}` is NOT part of the published V1 documentation — it is
 * undocumented but works against live merchant accounts, and we chose to depend
 * on it deliberately. The consequence is that its response shape is not
 * contractual, so parsing is tolerant: counts are read from the envelope or a
 * nested `data` object under any of the spellings seen in the wild, and an
 * unrecognised shape raises a clean error the UI renders as "couldn't check"
 * rather than a broken card.
 */
async function checkCustomer(
  input: { phone: string },
  context: CourierContext
): Promise<CustomerScoreResult> {
  const data = await steadfastRequest<Record<string, unknown>>(context, {
    method: "GET",
    path: `/fraud_check/${encodeURIComponent(input.phone)}`,
    retry: true
  });

  const source = pickSource(data);
  const totalParcels = readCount(source, ["total_parcels", "totalParcels", "total_order", "total"]);
  const totalDelivered = readCount(source, ["total_delivered", "totalDelivered", "delivered"]);

  if (totalParcels === null || totalDelivered === null) {
    throw new CourierError(
      "UNKNOWN",
      "The courier's delivery-history check returned a response we could not read."
    );
  }

  return {
    raw: redactSecrets(data),
    totalCancelled: readCount(source, ["total_cancelled", "totalCancelled", "cancelled"]),
    totalDelivered,
    totalParcels
  };
}

function pickSource(data: Record<string, unknown>) {
  const nested = data.data;

  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : data;
}

function readCount(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

/** The cheapest authenticated read — a 200 proves key + secret are both valid. */
async function testConnection(context: CourierContext) {
  const { amount } = await getBalance(context);

  return { message: `Connected. Current balance ৳${amount.toLocaleString("en-BD")}.`, ok: true };
}

function toNullableString(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}
