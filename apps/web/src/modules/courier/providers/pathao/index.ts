import { CourierError } from "../../courier-errors";
import { redactSecrets } from "../../courier-http";
import type {
  CourierContext,
  CourierProvider,
  CreateShipmentInput,
  CreateShipmentResult,
  GetStatusInput,
  ShipmentStatusResult
} from "../provider.types";
import { pathaoProductionBaseUrl, pathaoRequest, pathaoSandboxBaseUrl } from "./client";
import { toPathaoOrderPayload } from "./mapper";
import { pathaoStatusToShipmentStatus } from "./status-map";

/**
 * Pathao Courier — the second provider, and the test of the abstraction.
 *
 * Everything Pathao-specific is contained here and in its three sibling files:
 * OAuth2 token issue/refresh, the pickup-store id, its own field names and its
 * own status vocabulary. The courier service, repository, status pipeline, bulk
 * framework and every UI surface are untouched by its arrival — it appears in
 * settings, on the send button, in bulk and in the status refresh purely by
 * being registered.
 */

type OrderResponse = {
  data?: {
    consignment_id?: string | null;
    delivery_fee?: number | null;
    merchant_order_id?: string | null;
    order_status?: string | null;
  } | null;
  message?: string;
};

type OrderInfoResponse = {
  data?: {
    consignment_id?: string | null;
    order_status?: string | null;
    order_status_slug?: string | null;
    updated_at?: string | null;
  } | null;
};

type StoreListResponse = {
  data?: {
    data?: Array<{
      is_active?: number | null;
      is_default_store?: boolean | number | null;
      store_id?: number | string | null;
      store_name?: string | null;
    }> | null;
  } | null;
};

export const pathaoProvider: CourierProvider = {
  capabilities: {
    // No balance endpoint in the merchant API — price-plan quoting is not the
    // same thing, so the settings card simply shows no balance row.
    balance: false,
    // The bulk endpoint exists but answers 202 { data: true } with no per-item
    // results and no consignment ids, and Pathao offers no lookup by
    // merchant_order_id — so a bulk-created parcel could never be reconciled or
    // tracked. Declaring false routes bulk sends through the framework's
    // sequential single-send path, which returns a consignment id per order and
    // keeps every guarantee intact. Flip this to true (and implement
    // createShipments) only if Pathao starts returning per-item identifiers.
    bulkMaxBatchSize: null,
    cancel: false,
    // No fraud_check equivalent. Our own order-history score still works.
    customerScore: false,
    label: false,
    nativeBulk: false,
    payouts: false,
    returnRequest: false,
    // City/zone/area lists exist, but destination resolution is not implemented.
    serviceAreas: true,
    // Order info is keyed by consignment id only.
    statusLookupKeys: ["consignmentId"],
    webhook: true
  },
  createShipment,
  credentialFields: [
    {
      defaultValue: pathaoSandboxBaseUrl,
      helpText: `Sandbox: ${pathaoSandboxBaseUrl} · Live: ${pathaoProductionBaseUrl}`,
      label: "API Base URL",
      name: "baseUrl",
      placeholder: pathaoSandboxBaseUrl,
      required: true,
      secret: false,
      type: "url"
    },
    {
      label: "Client ID",
      name: "clientId",
      placeholder: "From Merchant Panel → Developer API",
      required: true,
      secret: true
    },
    {
      label: "Client Secret",
      name: "clientSecret",
      placeholder: "From Merchant Panel → Developer API",
      required: true,
      secret: true
    },
    {
      label: "Merchant Email",
      name: "username",
      placeholder: "Your Pathao login email",
      required: true,
      secret: false
    },
    {
      label: "Merchant Password",
      name: "password",
      placeholder: "Your Pathao login password",
      required: true,
      secret: true
    },
    {
      helpText: "Pickup location. Leave blank to use your default Pathao store automatically.",
      label: "Store ID",
      name: "storeId",
      placeholder: "e.g. 148127",
      required: false,
      secret: false
    }
  ],
  getStatus,
  key: "pathao",
  label: "Pathao",
  testConnection
};

async function createShipment(
  input: CreateShipmentInput,
  context: CourierContext
): Promise<CreateShipmentResult> {
  const storeId = await resolveStoreId(context);
  const payload = toPathaoOrderPayload(input, storeId);

  // No retry, ever: a retried order is a second real parcel.
  const data = await pathaoRequest<OrderResponse>(context, {
    body: payload,
    method: "POST",
    path: "/aladdin/api/v1/orders"
  });

  const consignmentId = data.data?.consignment_id?.trim() || null;

  if (!consignmentId) {
    throw new CourierError("UNKNOWN", data.message?.trim() || "Pathao did not return a consignment id.");
  }

  const providerStatus = data.data?.order_status?.trim() || null;

  return {
    providerShipmentId: consignmentId,
    providerStatus,
    raw: redactSecrets(data),
    status: providerStatus ? pathaoStatusToShipmentStatus(providerStatus) : "BOOKED",
    // Pathao has no separate customer-facing code; the consignment id is it.
    trackingCode: consignmentId
  };
}

async function getStatus(
  input: GetStatusInput,
  context: CourierContext
): Promise<ShipmentStatusResult> {
  if (!input.consignmentId) {
    // Unlike Steadfast there is no status_by_invoice equivalent, so a booking
    // that never returned an id cannot be reconciled against Pathao.
    throw new CourierError(
      "VALIDATION",
      "Pathao can only look up a parcel by consignment id, and this shipment has none recorded yet."
    );
  }

  const data = await pathaoRequest<OrderInfoResponse>(context, {
    method: "GET",
    path: `/aladdin/api/v1/orders/${encodeURIComponent(input.consignmentId)}/info`,
    retry: true
  });

  const providerStatus =
    data.data?.order_status_slug?.trim() || data.data?.order_status?.trim() || null;

  return {
    providerStatus,
    raw: redactSecrets(data),
    status: pathaoStatusToShipmentStatus(providerStatus)
  };
}

/**
 * Cheapest authenticated read: it proves the OAuth grant works end to end and
 * reports which pickup stores the merchant has, so the seller can pick one.
 */
async function testConnection(context: CourierContext) {
  const stores = await fetchStores(context);

  if (stores.length === 0) {
    return { message: "Connected, but this Pathao account has no pickup store yet.", ok: true };
  }

  const configured = context.credentials.storeId?.trim();
  const summary = stores
    .slice(0, 5)
    .map((store) => `${store.store_name ?? "Store"} (${store.store_id})`)
    .join(", ");

  // A store id that does not belong to this account is only rejected at send
  // time, with a bare "Wrong Store selected". Catching it here means the seller
  // finds out while setting up rather than on a real parcel.
  if (configured && !stores.some((store) => String(store.store_id) === configured)) {
    return {
      message: `Connected, but store ${configured} does not belong to this Pathao account — sending will fail. Pick one of: ${summary}.`,
      ok: false
    };
  }

  return {
    message: configured
      ? `Connected. Using store ${configured}. Available: ${summary}.`
      : `Connected. ${stores.length === 1 ? "Using your only store" : "No store selected — will use your default store"}: ${summary}.`,
    ok: true
  };
}

/**
 * The pickup location. Prefers the seller's explicit choice, then their Pathao
 * default store, then their only store — and caches the resolution so a send
 * costs one call rather than two.
 */
async function resolveStoreId(context: CourierContext) {
  const configured = Number(context.credentials.storeId?.trim() ?? "");

  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  const cache = await context.secretStore.read();
  const cached = Number(cache.pathaoStoreId ?? "");

  if (Number.isFinite(cached) && cached > 0) {
    return cached;
  }

  const stores = await fetchStores(context);
  const active = stores.filter((store) => store.is_active !== 0);
  const chosen =
    active.find((store) => store.is_default_store === true || store.is_default_store === 1) ??
    (active.length === 1 ? active[0] : undefined);

  if (!chosen) {
    throw new CourierError(
      "VALIDATION",
      active.length === 0
        ? "This Pathao account has no active pickup store. Create one in the Pathao merchant panel first."
        : `Several Pathao pickup stores exist and none is marked default. Enter a Store ID in courier settings — for example ${active
            .slice(0, 3)
            .map((store) => `${store.store_name ?? "Store"} (${store.store_id})`)
            .join(", ")}.`
    );
  }

  const storeId = Number(chosen.store_id);

  if (!Number.isFinite(storeId) || storeId <= 0) {
    throw new CourierError("VALIDATION", "Pathao returned an unreadable store id.");
  }

  await context.secretStore.write({ pathaoStoreId: String(storeId) });

  return storeId;
}

async function fetchStores(context: CourierContext) {
  const data = await pathaoRequest<StoreListResponse>(context, {
    method: "GET",
    path: "/aladdin/api/v1/stores",
    retry: true
  });

  return data.data?.data ?? [];
}
