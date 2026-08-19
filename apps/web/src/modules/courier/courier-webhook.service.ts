import { randomBytes } from "node:crypto";
import { createSystemLog } from "../../lib/system-log";
import { hasPlanFeature } from "../billing/subscription-limits";
import { decryptCredentials, encryptCredentials } from "./courier-credentials";
import { CourierError } from "./courier-errors";
import { applyShipmentStatus } from "./courier-status";
import {
  clearCourierAccountWebhookForStore,
  findShipmentByCarrierReferenceForStore,
  getCourierAccountByWebhookToken,
  getCourierAccountForStore,
  getCourierAccountsForStore,
  touchCourierAccountWebhookSeenForStore,
  updateCourierAccountWebhookForStore
} from "./courier.repository";
import { getCourierProvider, requireCourierProvider } from "./providers/registry";
import type { CourierWebhookRequest } from "./providers/provider.types";

/**
 * Inbound courier callbacks — the auto-sync half of order tracking.
 *
 * A webhook and a manual refresh are the same fact arriving by different roads,
 * so neither writes a shipment row: both produce a StatusUpdate and hand it to
 * `applyShipmentStatus`, which owns the out-of-order and terminal-regression
 * guards. That is what makes this file additive rather than a second, subtly
 * different status pipeline.
 *
 * Two secrets, doing two different jobs:
 *
 * - `webhookToken` sits in the URL path and answers *which tenant*. Carrier
 *   payloads carry no store identity — Steadfast configures one callback URL per
 *   merchant account and Pathao one per merchant — so without a per-account
 *   token in the path there is nothing to route on.
 * - `webhookSecret` is the Bearer/signature the seller pastes into the carrier's
 *   panel, and answers *is this really the carrier*. It is stored encrypted with
 *   the same key as the credentials and compared in constant time inside the
 *   provider adapter.
 *
 * Neither is derivable from the other, so a leaked URL alone does not let anyone
 * write delivery statuses into a store.
 */

const TOKEN_BYTES = 24;

export type CourierWebhookView = {
  /** Null until the seller generates one. */
  lastSeenAt: Date | null;
  provider: string;
  providerLabel: string;
  /** Plaintext, because the seller has to paste it into the carrier's panel. */
  secret: string | null;
  setupHint: string;
  supported: boolean;
  url: string | null;
};

/**
 * Where a carrier should call. Follows the same `NEXTAUTH_URL` convention the
 * social-settings page already uses for its callback URLs, so an operator
 * configures one base URL rather than one per feature.
 */
export function courierWebhookBaseUrl() {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function courierWebhookUrlForToken(token: string) {
  return `${courierWebhookBaseUrl()}/api/courier/webhook/${token}`;
}

/** Rows for the settings card: one per configured, webhook-capable carrier. */
export async function listCourierWebhookViews(storeId: string): Promise<CourierWebhookView[]> {
  const accounts = await getCourierAccountsForStore(storeId);

  return accounts.flatMap((account) => {
    const provider = getCourierProvider(account.provider);

    if (!provider) {
      return [];
    }

    return [
      {
        lastSeenAt: account.webhookLastSeenAt,
        provider: account.provider,
        providerLabel: provider.label,
        secret: readWebhookSecret(account.webhookSecret),
        setupHint:
          provider.webhook?.setupHint ??
          `${provider.label} does not publish a delivery webhook yet — use Refresh status on an order instead.`,
        supported: Boolean(provider.webhook),
        url: account.webhookToken ? courierWebhookUrlForToken(account.webhookToken) : null
      }
    ];
  });
}

/**
 * Issues a fresh token and secret, replacing any existing pair.
 *
 * Regeneration is deliberately destructive: the old URL stops working the moment
 * this returns, which is the whole point when a token has leaked. The seller is
 * told to re-paste both values into the carrier's panel.
 */
export async function generateCourierWebhook(storeId: string, providerKey: string) {
  const provider = requireCourierProvider(providerKey);

  if (!provider.webhook) {
    throw new CourierError("VALIDATION", `${provider.label} does not support delivery webhooks yet.`);
  }

  const account = await getCourierAccountForStore(storeId, provider.key);

  if (!account?.credentialsCipher) {
    throw new CourierError(
      "VALIDATION",
      `Add and test your ${provider.label} credentials before setting up its webhook.`
    );
  }

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const secret = randomBytes(TOKEN_BYTES).toString("base64url");

  await updateCourierAccountWebhookForStore(storeId, provider.key, {
    webhookSecret: encryptCredentials({ secret }),
    webhookToken: token
  });

  return { provider: provider.key, secret, url: courierWebhookUrlForToken(token) };
}

export async function disableCourierWebhook(storeId: string, providerKey: string) {
  const provider = requireCourierProvider(providerKey);

  await clearCourierAccountWebhookForStore(storeId, provider.key);

  return { provider: provider.key };
}

export type ReceiveWebhookResult = {
  /** Response headers the carrier requires on a successful ack. */
  ackHeaders: Record<string, string>;
  applied: number;
  reason: string;
  status: number;
};

/**
 * The receiver.
 *
 * Every outcome that is not "we cannot identify you" answers 200. A carrier that
 * gets a 4xx retries, then gives up and disables the endpoint — so a payload we
 * deliberately skip, an event about a parcel we have no row for, or a store
 * whose plan no longer includes tracking must all read as "received" rather than
 * as a broken integration. Only an unknown token or a failed signature is
 * refused, and both answer 404 so an attacker cannot tell a wrong token from a
 * wrong secret.
 */
export async function receiveCourierWebhook(
  token: string,
  request: CourierWebhookRequest
): Promise<ReceiveWebhookResult> {
  const account = await getCourierAccountByWebhookToken(token);
  const provider = account ? getCourierProvider(account.provider) : null;
  const secret = account ? readWebhookSecret(account.webhookSecret) : null;

  if (!account || !provider?.webhook || !secret) {
    return refused("Unknown webhook endpoint.");
  }

  if (!provider.webhook.verify(request, secret)) {
    await createSystemLog({
      level: "WARNING",
      message: `Rejected a ${provider.label} webhook with an invalid secret.`,
      source: "ORDER",
      storeId: account.storeId
    });

    return refused("Unknown webhook endpoint.");
  }

  const ackHeaders = { ...(provider.webhook.ackHeaders ?? {}) };

  // The carrier reached us and proved who it is — worth recording even when the
  // payload turns out to be a ping, because "never seen" is what a seller
  // debugging their setup actually needs to know.
  await touchCourierAccountWebhookSeenForStore(account.storeId, account.provider);

  if (!(await hasPlanFeature(account.storeId, "order_tracking"))) {
    return { ackHeaders, applied: 0, reason: "Order Tracking is not on this store's plan.", status: 200 };
  }

  const parsed = provider.webhook.parse(request);

  if (parsed.kind === "IGNORED") {
    return { ackHeaders, applied: 0, reason: parsed.reason, status: 200 };
  }

  let applied = 0;
  let unmatched = 0;

  for (const event of parsed.events) {
    const shipment = await findShipmentByCarrierReferenceForStore(
      account.storeId,
      account.provider,
      event.reference
    );

    if (!shipment) {
      unmatched += 1;
      continue;
    }

    try {
      await applyShipmentStatus({
        payload: request.body,
        providerStatus: event.providerStatus,
        shipmentId: shipment.id,
        source: "PROVIDER_WEBHOOK",
        storeId: account.storeId,
        ...(event.message !== undefined ? { message: event.message } : {}),
        ...(event.occurredAt ? { occurredAt: event.occurredAt } : {}),
        ...(event.status ? { status: event.status } : {})
      });

      applied += 1;
    } catch (error) {
      // One bad event must not cost us the rest of a batch, and must not make
      // the carrier retry the whole payload.
      await createSystemLog({
        level: "ERROR",
        message: `Could not apply a ${provider.label} delivery update: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        source: "ORDER",
        storeId: account.storeId
      });
    }
  }

  if (unmatched > 0) {
    await createSystemLog({
      level: "WARNING",
      message: `${provider.label} sent ${unmatched} delivery update${
        unmatched === 1 ? "" : "s"
      } for a parcel this store has no shipment for.`,
      source: "ORDER",
      storeId: account.storeId
    });
  }

  return {
    ackHeaders,
    applied,
    reason: applied > 0 ? "Delivery status updated." : "No matching shipment.",
    status: 200
  };
}

function refused(reason: string): ReceiveWebhookResult {
  return { ackHeaders: {}, applied: 0, reason, status: 404 };
}

/**
 * A rotated `COURIER_CREDENTIALS_KEY` invalidates the stored secret rather than
 * throwing on every inbound call. Returning null makes the endpoint answer 404
 * until the seller regenerates, which is the correct fail-closed direction.
 */
function readWebhookSecret(cipher: string | null) {
  if (!cipher) {
    return null;
  }

  try {
    return decryptCredentials(cipher).secret ?? null;
  } catch {
    return null;
  }
}
