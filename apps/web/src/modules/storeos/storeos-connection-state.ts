import { STOREOS_AI_CAPABILITIES, type StoreOSAiCapability } from "@dash/storeos-sdk";

/**
 * The five states the merchant is ever shown, and the one word each is called.
 *
 * `connecting` only ever exists in the browser, for the moment between clicking
 * the button and the server action resolving; the other four are derived from
 * the stored row. Keeping all five in one union means the panel has a single
 * exhaustive switch instead of a chain of booleans that can contradict itself.
 */
export type StoreOSConnectionPhase =
  | "connected"
  | "connecting"
  | "failed"
  | "not-connected"
  | "reconnect-required";

export type StoreOSConnectionView = {
  /** What StoreOS granted this store. Empty until a connection succeeds. */
  capabilities: StoreOSAiCapability[];
  connectionId: string | null;
  /** Merchant-facing sentence. Never names an environment variable or a URL. */
  detail: string;
  label: string;
  lastSyncedAt: string | null;
  phase: StoreOSConnectionPhase;
};

/** The narrow shape this module needs, so it can be exercised without Prisma. */
export type StoreOSConnectionRow = {
  capabilities: unknown;
  lastSyncedAt: Date | null;
  status: string;
  storeosConnectionId: string | null;
};

const PHASE_LABELS: Record<StoreOSConnectionPhase, string> = {
  connected: "Connected",
  connecting: "Connecting",
  failed: "Connection failed",
  "not-connected": "Not connected",
  "reconnect-required": "Reconnect required"
};

export function storeOSPhaseLabel(phase: StoreOSConnectionPhase) {
  return PHASE_LABELS[phase];
}

/**
 * Turn the stored connection into something safe to hand a browser.
 *
 * Two inputs, and the second is the one that matters: `linkProvisioned` is the
 * operator's `STOREOS_API_URL`/`STOREOS_API_KEY` question, and it is collapsed
 * to a boolean *here*, on the server, so no page prop and no action result ever
 * carries the credential or even the variable names. A deployment whose link is
 * not provisioned reads as "Not connected" with an explanation that this is the
 * platform's job — never as an instruction for the seller to go and configure
 * StoreOS themselves.
 *
 * `status === "connected"` with no connection id is treated as reconnect-required
 * rather than connected: an id is what every subsequent request is addressed to,
 * so a row without one is a connection in name only.
 */
export function toStoreOSConnectionView(
  connection: StoreOSConnectionRow | null,
  linkProvisioned: boolean
): StoreOSConnectionView {
  const capabilities = readGrantedCapabilities(connection?.capabilities);
  const base = {
    capabilities,
    connectionId: connection?.storeosConnectionId ?? null,
    lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null
  };

  const phase = resolvePhase(connection, linkProvisioned);

  return {
    ...base,
    detail: phaseDetail(phase, linkProvisioned),
    label: PHASE_LABELS[phase],
    phase
  };
}

function resolvePhase(
  connection: StoreOSConnectionRow | null,
  linkProvisioned: boolean
): StoreOSConnectionPhase {
  // No platform link means no store is reachable by StoreIM AI, whatever a row
  // left over from a previous deployment happens to say.
  if (!linkProvisioned) {
    return "not-connected";
  }

  if (connection?.status === "error") {
    return "failed";
  }

  if (connection?.status === "disabled") {
    return "reconnect-required";
  }

  if (connection?.status === "connected") {
    return connection.storeosConnectionId ? "connected" : "reconnect-required";
  }

  // `pending`, an unknown status, and no row at all are the same thing to a
  // seller: this store has never completed a connection.
  return "not-connected";
}

function phaseDetail(phase: StoreOSConnectionPhase, linkProvisioned: boolean) {
  if (!linkProvisioned) {
    return "StoreIM AI is not switched on for this platform yet. Nothing is needed from you — it becomes available once the platform enables it.";
  }

  switch (phase) {
    case "connected":
      return "StoreIM AI is connected to this store and answering from your own data.";
    case "connecting":
      return "Connecting StoreIM AI to this store.";
    case "failed":
      return "StoreIM AI could not be reached on the last attempt. Try connecting again.";
    case "reconnect-required":
      return "This store's StoreIM AI connection is no longer valid. Connect again to restore it.";
    case "not-connected":
      return "StoreIM AI is not connected to this store yet. Connect it to start asking about your orders, sales, and stock.";
  }
}

/**
 * Read the granted capability list back out of the JSON column.
 *
 * Defensive because `capabilities` is `Json`: it holds whatever StoreOS returned
 * on the day of the connection, including from a version that predates this
 * field. Anything unrecognised is dropped rather than trusted, so a capability
 * cannot be conjured into existence by writing a string into the database.
 */
export function readGrantedCapabilities(value: unknown): StoreOSAiCapability[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const granted = (value as Record<string, unknown>).granted;

  if (!Array.isArray(granted)) {
    return [];
  }

  return STOREOS_AI_CAPABILITIES.filter((capability) => granted.includes(capability));
}
