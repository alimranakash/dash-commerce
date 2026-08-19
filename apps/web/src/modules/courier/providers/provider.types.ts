import type { CourierProviderKey, ShipmentStatus } from "../courier.types";

/**
 * The contract every carrier implements.
 *
 * An adapter is pure: domain object in, domain object out. It never reads
 * settings, never touches Prisma, and never imports an Order type. That is what
 * makes a second provider cheap and an adapter testable on its own.
 *
 * Optional methods are declared through `capabilities` so the UI can render only
 * what a carrier actually supports, instead of showing a button that fails at
 * click time. A capability describes what the *carrier* offers; a feature only
 * lights up when the matching method is also present on the adapter, which keeps
 * "the carrier supports this" and "we built this" as two separate facts.
 */

export type StatusLookupKey = "consignmentId" | "invoice" | "trackingCode";

export type CourierCapabilities = {
  balance: boolean;
  /** Carrier ceiling for a single bulk call; our own cap is lower. */
  bulkMaxBatchSize: number | null;
  cancel: boolean;
  customerScore: boolean;
  label: boolean;
  nativeBulk: boolean;
  payouts: boolean;
  returnRequest: boolean;
  serviceAreas: boolean;
  statusLookupKeys: StatusLookupKey[];
  webhook: boolean;
};

export type CredentialField = {
  defaultValue?: string | undefined;
  helpText?: string | undefined;
  label: string;
  name: string;
  placeholder?: string | undefined;
  required: boolean;
  secret: boolean;
  type?: "text" | "url" | undefined;
};

/**
 * Encrypted per-account scratch space for values an adapter derives at runtime
 * rather than receiving from the seller — OAuth access/refresh tokens, a
 * resolved pickup-store id, a cached area map.
 *
 * Provider-agnostic on purpose: it is just a string map, so the courier layer
 * never learns what any carrier keeps in it. Steadfast's static key/secret auth
 * simply never touches it.
 */
export type CourierSecretStore = {
  read: () => Promise<Record<string, string>>;
  write: (values: Record<string, string>) => Promise<void>;
};

export type CourierContext = {
  /** Already decrypted and validated. */
  credentials: Record<string, string>;
  requestId: string;
  secretStore: CourierSecretStore;
  /** For logging and rate-limit keys only — never sent upstream. */
  storeId: string;
  timeoutMs: number;
};

export type ShipmentRecipient = {
  address: string;
  alternatePhone?: string | undefined;
  area?: string | undefined;
  city?: string | undefined;
  district?: string | undefined;
  email?: string | undefined;
  name: string;
  phone: string;
  postalCode?: string | undefined;
};

/**
 * A deliberate superset. Steadfast uses ten of these, Pathao needs
 * district/city/area, and nobody breaks when a field is absent. `deliveryType`
 * stays a domain enum so no carrier's integer coding leaks out of its adapter.
 */
export type CreateShipmentInput = {
  codAmount: number;
  deliveryType?: "HOME" | "HUB_PICKUP" | undefined;
  itemDescription?: string | undefined;
  note?: string | undefined;
  quantity?: number | undefined;
  recipient: ShipmentRecipient;
  reference: string;
  weightGrams?: number | undefined;
};

export type CreateShipmentResult = {
  labelUrl?: string | undefined;
  providerShipmentId: string | null;
  providerStatus: string | null;
  raw: unknown;
  status: ShipmentStatus;
  trackingCode: string | null;
};

export type TestConnectionResult = {
  message: string;
  ok: boolean;
};

/**
 * At least one key is always present. Which ones a carrier can actually use is
 * declared in `capabilities.statusLookupKeys`, so the service can pick a lookup
 * the adapter supports instead of guessing.
 */
export type GetStatusInput = {
  consignmentId?: string | null | undefined;
  reference?: string | null | undefined;
  trackingCode?: string | null | undefined;
};

export type ShipmentStatusResult = {
  /** The carrier's own string, kept verbatim for display. */
  providerStatus: string | null;
  raw: unknown;
  status: ShipmentStatus;
};

export type BalanceResult = {
  amount: number;
  currency: string;
};

/**
 * Keyed by *our* reference, never by position — bulk responses do not promise
 * to preserve request order.
 *
 * UNMATCHED is a first-class outcome, not an error: the carrier answered, but
 * not about a request we can confidently identify. Those route to invoice
 * reconciliation rather than being guessed at in either direction.
 */
export type BulkShipmentItemResult =
  | { outcome: "SUCCESS"; reference: string; result: CreateShipmentResult }
  | { message: string; outcome: "ERROR"; reference: string }
  | { message: string; outcome: "UNMATCHED"; reference: string };

export type BulkShipmentResult = {
  raw: unknown;
  results: BulkShipmentItemResult[];
};

/**
 * An inbound carrier callback, reduced to the two things an adapter needs and
 * nothing more. `headers` are lowercased by the route so an adapter never has to
 * guess at casing, and `rawBody` is the exact bytes as received, for carriers
 * that sign the payload.
 */
export type CourierWebhookRequest = {
  body: unknown;
  headers: Record<string, string>;
  rawBody: string;
};

/**
 * One delivery update lifted out of a webhook payload.
 *
 * `status` is optional on purpose: Steadfast's `tracking_update` carries a
 * free-text movement note with no status change at all, and the pipeline records
 * it as a timeline entry rather than inventing a transition. `reference` is how
 * the receiver finds our shipment — the payload never carries a store id, and it
 * may name the parcel by any of the three keys.
 */
export type CourierWebhookEvent = {
  message?: string | null | undefined;
  occurredAt?: Date | undefined;
  providerStatus: string | null;
  reference: {
    consignmentId?: string | null | undefined;
    invoice?: string | null | undefined;
    trackingCode?: string | null | undefined;
  };
  status?: ShipmentStatus | undefined;
};

/**
 * IGNORED is a success, not a failure: a carrier ping, an event type we do not
 * act on, or a payload shape we deliberately skip. The receiver answers 200 to
 * all of them so the carrier does not retry something that will never change.
 */
export type CourierWebhookParseResult =
  | { events: CourierWebhookEvent[]; kind: "EVENTS" }
  | { kind: "IGNORED"; reason: string };

/**
 * Present iff `capabilities.webhook` and we have actually built the receiver
 * side for that carrier. Everything carrier-specific about callbacks — auth
 * scheme, payload shape, and any acknowledgement the carrier insists on — is
 * contained here, so `/api/courier/webhook/[token]` stays provider-agnostic.
 */
export type CourierWebhookAdapter = {
  /** Extra response headers the carrier requires on a successful ack. */
  readonly ackHeaders?: Record<string, string> | undefined;
  readonly parse: (request: CourierWebhookRequest) => CourierWebhookParseResult;
  /** Seller-facing copy for the settings card — where to paste the URL. */
  readonly setupHint: string;
  /** Constant-time comparison lives in the adapter's helper, never a `===`. */
  readonly verify: (request: CourierWebhookRequest, secret: string) => boolean;
};

/**
 * Raw counts only. The success ratio is computed once in the service so every
 * carrier agrees on the formula rather than each adapter inventing one.
 */
export type CustomerScoreResult = {
  raw: unknown;
  totalCancelled: number | null;
  totalDelivered: number;
  totalParcels: number;
};

export type CourierProvider = {
  readonly capabilities: CourierCapabilities;
  readonly createShipment: (
    input: CreateShipmentInput,
    context: CourierContext
  ) => Promise<CreateShipmentResult>;
  readonly credentialFields: readonly CredentialField[];
  readonly getStatus: (
    input: GetStatusInput,
    context: CourierContext
  ) => Promise<ShipmentStatusResult>;
  readonly key: CourierProviderKey;
  readonly label: string;
  readonly testConnection: (context: CourierContext) => Promise<TestConnectionResult>;

  /** Present iff capabilities.nativeBulk. One call, N independently settled results. */
  readonly createShipments?: (
    inputs: CreateShipmentInput[],
    context: CourierContext
  ) => Promise<BulkShipmentResult>;
  /** Present iff capabilities.balance. */
  readonly getBalance?: (context: CourierContext) => Promise<BalanceResult>;
  /** Present iff capabilities.customerScore. */
  readonly checkCustomer?: (
    input: { phone: string },
    context: CourierContext
  ) => Promise<CustomerScoreResult>;
  /** Present iff capabilities.webhook and the receiver side is built. */
  readonly webhook?: CourierWebhookAdapter;
};
