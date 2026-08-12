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

export type CourierContext = {
  /** Already decrypted and validated. */
  credentials: Record<string, string>;
  requestId: string;
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
};
