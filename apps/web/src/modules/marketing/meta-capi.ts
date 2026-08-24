import { createHash } from "node:crypto";
import { hasPlanFeature } from "../billing/subscription-limits";
import { decryptSecret } from "../../lib/secret-box";
import { createSystemLog } from "../../lib/system-log";
import { getMarketingSettingsRecord, getOrderForMetaEvent } from "./marketing.repository";
import { marketingIdPatterns } from "./marketing.schema";

/**
 * Meta Conversions API — the server-to-server half of the pixel.
 *
 * Architecturally unlike every other marketing integration here: nothing in this
 * file is ever rendered into a page. It runs on the server, authenticates with a
 * secret the browser never sees, and posts events directly to Meta.
 *
 * Two rules this module is built around:
 *
 * 1. It can never fail a checkout. Every entry point resolves rather than
 *    rejects; problems land in SystemLog and stop there. The order is already
 *    committed by the time anything here runs.
 * 2. The access token is decrypted at call time, held in a local, and never
 *    logged, cached, returned, or attached to an error.
 */

const graphApiVersion = "v21.0";
const requestTimeoutMs = 5_000;

export type MetaCapiResult =
  | { events: number; ok: true }
  | { message: string; ok: false; reason: "disabled" | "failed" | "not-configured" };

/**
 * Deterministic per order, so the browser pixel and this sender agree without
 * having to pass anything between them — and so a customer refreshing the
 * thank-you page dedupes against the same event rather than inflating counts.
 */
export function metaEventIdForOrder(orderId: string) {
  return `order.${orderId}`;
}

/**
 * Fires Purchase after an order is confirmed. Never throws — callers on the
 * checkout path can await it without a try/catch and cannot be broken by it.
 *
 * Takes an order id rather than a payload so the checkout route stays free of
 * marketing concerns: the config check happens first, and an order is only read
 * back when there is actually somewhere to send it.
 */
export async function sendMetaPurchaseEvent(input: {
  eventSourceUrl?: string | undefined;
  orderId: string;
  storeId: string;
}): Promise<MetaCapiResult> {
  try {
    const config = await resolveConfig(input.storeId);

    if (!config.ok) {
      return config.result;
    }

    const order = await getOrderForMetaEvent(input.storeId, input.orderId);

    if (!order) {
      return { message: "Order not found.", ok: false, reason: "not-configured" };
    }

    return await postEvents({
      events: [
        {
          action_source: "website",
          custom_data: {
            content_type: "product",
            contents: order.items.map((item) => ({
              id: item.sku ?? item.title,
              quantity: item.quantity
            })),
            currency: order.currency,
            num_items: order.items.reduce((total, item) => total + item.quantity, 0),
            order_id: order.orderNumber,
            value: Number(order.totalAmount)
          },
          event_id: metaEventIdForOrder(order.id),
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
          user_data: buildUserData({
            customerEmail: order.customerEmail,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            shippingCountry: order.shippingAddress?.country ?? null
          })
        }
      ],
      label: `Purchase ${order.orderNumber}`,
      pixelId: config.pixelId,
      source: "ORDER",
      storeId: input.storeId,
      token: config.token
    });
  } catch (error) {
    // Belt and braces: resolveConfig/postEvents already contain their own
    // handling, so reaching here means something genuinely unexpected.
    await safeLog({
      level: "ERROR",
      message: "Meta Conversions API purchase event failed unexpectedly.",
      metadata: { error: errorText(error), orderId: input.orderId },
      source: "ORDER",
      storeId: input.storeId
    });

    return { message: errorText(error), ok: false, reason: "failed" };
  }
}

/**
 * Seller-triggered check from settings. Sends a real, clearly-labelled TestEvent
 * so the token and pixel can be verified without placing an order.
 */
export async function sendMetaTestEvent(input: {
  storeId: string;
  userId?: string | undefined;
}): Promise<MetaCapiResult> {
  const config = await resolveConfig(input.storeId);

  if (!config.ok) {
    return config.result;
  }

  return postEvents({
    events: [
      {
        action_source: "website",
        event_id: `test.${Date.now()}`,
        event_name: "TestEvent",
        event_time: Math.floor(Date.now() / 1000),
        user_data: {}
      }
    ],
    label: "Test event",
    pixelId: config.pixelId,
    source: "STORE",
    storeId: input.storeId,
    token: config.token,
    ...(input.userId ? { userId: input.userId } : {})
  });
}

/** Enabled, a decryptable token, and a well-formed pixel id — or a silent no-op. */
async function resolveConfig(storeId: string): Promise<
  | { ok: false; result: MetaCapiResult }
  | { ok: true; pixelId: string; token: string }
> {
  const record = await getMarketingSettingsRecord(storeId);

  if (!record?.metaCapiEnabled) {
    return {
      ok: false,
      result: { message: "The Conversions API is turned off.", ok: false, reason: "disabled" }
    };
  }

  // Re-checked at send time, not just at save time: a store that lapses to a
  // plan without server-side tracking keeps the saved config but must stop
  // sending, and nothing rewrites `metaCapiEnabled` when a subscription changes.
  if (!(await hasPlanFeature(storeId, "server_side_tracking"))) {
    return {
      ok: false,
      result: {
        message: "Server-side tracking is not included in this store's plan.",
        ok: false,
        reason: "disabled"
      }
    };
  }

  const pixelId = record.metaPixelId?.trim();

  if (!pixelId || !marketingIdPatterns.metaPixelId.test(pixelId)) {
    return {
      ok: false,
      result: { message: "No valid Meta Pixel ID is saved.", ok: false, reason: "not-configured" }
    };
  }

  let token: string | null;

  try {
    token = decryptSecret(record.metaCapiTokenCipher);
  } catch {
    // A rotated encryption key must not take checkout down with it.
    return {
      ok: false,
      result: {
        message: "The stored access token could not be decrypted. Re-enter it in settings.",
        ok: false,
        reason: "not-configured"
      }
    };
  }

  if (!token) {
    return {
      ok: false,
      result: { message: "No access token is saved.", ok: false, reason: "not-configured" }
    };
  }

  return { ok: true, pixelId, token };
}

async function postEvents(input: {
  events: Record<string, unknown>[];
  label: string;
  pixelId: string;
  source: "ORDER" | "STORE";
  storeId: string;
  token: string;
  userId?: string | undefined;
}): Promise<MetaCapiResult> {
  const url = `https://graph.facebook.com/${graphApiVersion}/${input.pixelId}/events`;

  try {
    const response = await fetch(url, {
      body: JSON.stringify({ data: input.events }),
      cache: "no-store",
      headers: {
        // Bearer rather than an `?access_token=` query parameter: tokens in URLs
        // end up in proxy and access logs.
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
    const text = await response.text();

    if (!response.ok) {
      await safeLog({
        level: "WARNING",
        message: `Meta Conversions API rejected ${input.label}.`,
        metadata: {
          // The pixel id is not a secret; the token is never in scope here.
          pixelId: input.pixelId,
          response: text.slice(0, 500),
          status: response.status
        },
        source: input.source,
        storeId: input.storeId,
        ...(input.userId ? { userId: input.userId } : {})
      });

      return { message: metaErrorMessage(text, response.status), ok: false, reason: "failed" };
    }

    return { events: input.events.length, ok: true };
  } catch (error) {
    const timedOut = error instanceof Error && /timeout|abort/i.test(error.name);

    await safeLog({
      level: "WARNING",
      message: `Meta Conversions API request failed for ${input.label}.`,
      metadata: { error: errorText(error), pixelId: input.pixelId, timedOut },
      source: input.source,
      storeId: input.storeId,
      ...(input.userId ? { userId: input.userId } : {})
    });

    return {
      message: timedOut ? "Meta did not respond in time." : "Could not reach Meta.",
      ok: false,
      reason: "failed"
    };
  }
}

/** Meta requires SHA-256 of normalised values; raw PII must never be sent. */
function buildUserData(customer: {
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  shippingCountry: string | null;
}) {
  const [firstName, ...restName] = (customer.customerName ?? "").trim().split(/\s+/);
  const lastName = restName.join(" ");
  const email = customer.customerEmail?.trim().toLowerCase();
  const phone = normalizePhone(customer.customerPhone);
  const country = customer.shippingCountry?.trim().toLowerCase();

  return {
    ...(email ? { em: [sha256(email)] } : {}),
    ...(phone ? { ph: [sha256(phone)] } : {}),
    ...(firstName ? { fn: [sha256(firstName.toLowerCase())] } : {}),
    ...(lastName ? { ln: [sha256(lastName.toLowerCase())] } : {}),
    ...(country === "bangladesh" ? { country: [sha256("bd")] } : {})
  };
}

/**
 * Meta wants digits only, including country code. Local Bangladeshi numbers are
 * stored as `01XXXXXXXXX`, so the 880 prefix is added rather than hashing a
 * number Meta cannot match.
 */
function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (!digits) {
    return null;
  }

  if (digits.startsWith("880")) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `88${digits}`;
  }

  if (digits.length === 10 && digits.startsWith("1")) {
    return `880${digits}`;
  }

  return digits;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function metaErrorMessage(text: string, status: number) {
  try {
    const parsed: unknown = JSON.parse(text);
    const message = (parsed as { error?: { message?: unknown } })?.error?.message;

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  } catch {
    // Fall through to the status-only message.
  }

  return `Meta returned HTTP ${status}.`;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

/** Logging must not be able to throw on a path that promised not to. */
async function safeLog(input: Parameters<typeof createSystemLog>[0]) {
  try {
    await createSystemLog(input);
  } catch {
    // Nothing useful left to do; swallowing keeps checkout unaffected.
  }
}
