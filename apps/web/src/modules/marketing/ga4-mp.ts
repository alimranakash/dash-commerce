import { createHash } from "node:crypto";
import { decryptSecret } from "../../lib/secret-box";
import { createSystemLog } from "../../lib/system-log";
import { getMarketingSettingsRecord, getOrderForGa4Event } from "./marketing.repository";
import { marketingIdPatterns } from "./marketing.schema";

/**
 * GA4 Measurement Protocol — the server-to-server half of gtag.js.
 *
 * The counterpart to `meta-capi.ts`, and built around the same two rules:
 *
 * 1. It can never fail a checkout. Every entry point resolves rather than
 *    rejects; problems land in SystemLog and stop there. The order is already
 *    committed by the time anything here runs.
 * 2. The API secret is decrypted at call time, held in a local, and never
 *    logged, cached, returned, or attached to an error.
 *
 * Two things differ from Meta, both forced by Google's API:
 *
 * - The secret goes in the query string. Unlike Meta's Graph API there is no
 *   header form, so the URL itself is sensitive: it is built inside `postEvents`
 *   and never logged, and the log metadata carries the measurement ID only.
 * - Success is not an acknowledgement. `/mp/collect` answers 204 to anything it
 *   can parse, including events it will silently drop, so a 2xx here means
 *   "delivered", not "accepted". `/debug/mp/collect` is the only endpoint that
 *   validates, which is what the seller-facing test event uses.
 */

const collectUrl = "https://www.google-analytics.com/mp/collect";
const debugCollectUrl = "https://www.google-analytics.com/debug/mp/collect";
const requestTimeoutMs = 5_000;

export type Ga4MpResult =
  | { events: number; ok: true }
  | { message: string; ok: false; reason: "disabled" | "failed" | "not-configured" };

/**
 * Fires `purchase` after an order is confirmed. Never throws — callers on the
 * checkout path can await it without a try/catch and cannot be broken by it.
 *
 * Takes an order id rather than a payload so the checkout route stays free of
 * marketing concerns: the config check happens first, and an order is only read
 * back when there is actually somewhere to send it.
 */
export async function sendGa4PurchaseEvent(input: {
  /** The visitor's `_ga` cookie, when the caller has one. See `resolveClientId`. */
  gaCookie?: string | undefined;
  orderId: string;
  pageLocation?: string | undefined;
  storeId: string;
}): Promise<Ga4MpResult> {
  try {
    const config = await resolveConfig(input.storeId);

    if (!config.ok) {
      return config.result;
    }

    const order = await getOrderForGa4Event(input.storeId, input.orderId);

    if (!order) {
      return { message: "Order not found.", ok: false, reason: "not-configured" };
    }

    return await postEvents({
      clientId: resolveClientId(input.gaCookie, order.id),
      events: [
        {
          name: "purchase",
          params: {
            currency: order.currency,
            items: order.items.map((item) => ({
              item_id: item.sku ?? item.title,
              item_name: item.title,
              price: Number(item.price),
              quantity: item.quantity
            })),
            shipping: Number(order.shippingAmount),
            tax: Number(order.taxAmount),
            // GA4 collapses `purchase` events sharing a transaction_id, so this
            // is the dedupe key against any browser-side purchase the seller
            // fires through gtag or GTM — and it also means a customer
            // refreshing the thank-you page cannot inflate revenue.
            transaction_id: order.orderNumber,
            value: Number(order.totalAmount),
            ...(input.pageLocation ? { page_location: input.pageLocation } : {})
          }
        }
      ],
      label: `Purchase ${order.orderNumber}`,
      measurementId: config.measurementId,
      secret: config.secret,
      source: "ORDER",
      storeId: input.storeId,
      userData: buildUserData({
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone
      })
    });
  } catch (error) {
    // Belt and braces: resolveConfig/postEvents already contain their own
    // handling, so reaching here means something genuinely unexpected.
    await safeLog({
      level: "ERROR",
      message: "GA4 Measurement Protocol purchase event failed unexpectedly.",
      metadata: { error: errorText(error), orderId: input.orderId },
      source: "ORDER",
      storeId: input.storeId
    });

    return { message: errorText(error), ok: false, reason: "failed" };
  }
}

/**
 * Seller-triggered check from settings. Validates against `/debug/mp/collect`
 * first — the only endpoint that will tell you the credentials or payload are
 * wrong — and only then sends the real event, so a pass here means the seller
 * can go and look for it in Realtime.
 */
export async function sendGa4TestEvent(input: {
  storeId: string;
  userId?: string | undefined;
}): Promise<Ga4MpResult> {
  const config = await resolveConfig(input.storeId);

  if (!config.ok) {
    return config.result;
  }

  const clientId = resolveClientId(undefined, `test.${input.storeId}`);
  const events = [
    {
      name: "dash_test_event",
      params: {
        engagement_time_msec: 1,
        session_id: `${Math.floor(Date.now() / 1000)}`
      }
    }
  ];

  const validation = await validateEvents({
    clientId,
    events,
    measurementId: config.measurementId,
    secret: config.secret,
    source: "STORE",
    storeId: input.storeId,
    ...(input.userId ? { userId: input.userId } : {})
  });

  if (!validation.ok) {
    return validation.result;
  }

  return postEvents({
    clientId,
    events,
    label: "Test event",
    measurementId: config.measurementId,
    secret: config.secret,
    source: "STORE",
    storeId: input.storeId,
    ...(input.userId ? { userId: input.userId } : {})
  });
}

/** Enabled, a decryptable secret, and a well-formed measurement ID — or a silent no-op. */
async function resolveConfig(
  storeId: string
): Promise<
  { ok: false; result: Ga4MpResult } | { measurementId: string; ok: true; secret: string }
> {
  const record = await getMarketingSettingsRecord(storeId);

  if (!record?.ga4MpEnabled) {
    return {
      ok: false,
      result: { message: "GA4 server-side tracking is turned off.", ok: false, reason: "disabled" }
    };
  }

  const measurementId = record.ga4MeasurementId?.trim();

  if (!measurementId || !marketingIdPatterns.ga4MeasurementId.test(measurementId)) {
    return {
      ok: false,
      result: {
        message: "No valid GA4 Measurement ID is saved.",
        ok: false,
        reason: "not-configured"
      }
    };
  }

  let secret: string | null;

  try {
    secret = decryptSecret(record.ga4ApiSecretCipher);
  } catch {
    // A rotated encryption key must not take checkout down with it.
    return {
      ok: false,
      result: {
        message: "The stored API secret could not be decrypted. Re-enter it in settings.",
        ok: false,
        reason: "not-configured"
      }
    };
  }

  if (!secret) {
    return {
      ok: false,
      result: { message: "No API secret is saved.", ok: false, reason: "not-configured" }
    };
  }

  return { measurementId, ok: true, secret };
}

async function postEvents(input: {
  clientId: string;
  events: Record<string, unknown>[];
  label: string;
  measurementId: string;
  secret: string;
  source: "ORDER" | "STORE";
  storeId: string;
  userData?: Record<string, unknown> | undefined;
  userId?: string | undefined;
}): Promise<Ga4MpResult> {
  try {
    const response = await fetch(endpointFor(collectUrl, input.measurementId, input.secret), {
      body: JSON.stringify(buildPayload(input)),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(requestTimeoutMs)
    });

    if (!response.ok) {
      const text = await response.text();

      await safeLog({
        level: "WARNING",
        message: `GA4 Measurement Protocol rejected ${input.label}.`,
        metadata: {
          // The measurement ID is not a secret; the API secret is only ever in
          // the URL, which deliberately does not appear here.
          measurementId: input.measurementId,
          response: text.slice(0, 500),
          status: response.status
        },
        source: input.source,
        storeId: input.storeId,
        ...(input.userId ? { userId: input.userId } : {})
      });

      return { message: `Google returned HTTP ${response.status}.`, ok: false, reason: "failed" };
    }

    return { events: input.events.length, ok: true };
  } catch (error) {
    const timedOut = error instanceof Error && /timeout|abort/i.test(error.name);

    await safeLog({
      level: "WARNING",
      message: `GA4 Measurement Protocol request failed for ${input.label}.`,
      metadata: { error: errorText(error), measurementId: input.measurementId, timedOut },
      source: input.source,
      storeId: input.storeId,
      ...(input.userId ? { userId: input.userId } : {})
    });

    return {
      message: timedOut ? "Google did not respond in time." : "Could not reach Google Analytics.",
      ok: false,
      reason: "failed"
    };
  }
}

/**
 * The debug endpoint takes the same payload and answers with the validation
 * messages the real endpoint swallows. An unreachable debug endpoint is not
 * treated as a failure of the credentials — only as an unverifiable test.
 */
async function validateEvents(input: {
  clientId: string;
  events: Record<string, unknown>[];
  measurementId: string;
  secret: string;
  source: "ORDER" | "STORE";
  storeId: string;
  userId?: string | undefined;
}): Promise<{ ok: false; result: Ga4MpResult } | { ok: true }> {
  try {
    const response = await fetch(endpointFor(debugCollectUrl, input.measurementId, input.secret), {
      body: JSON.stringify(buildPayload(input)),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
    const text = await response.text();
    const problem = firstValidationMessage(text);

    if (!problem) {
      return { ok: true };
    }

    await safeLog({
      level: "WARNING",
      message: "GA4 Measurement Protocol validation failed for a test event.",
      metadata: {
        measurementId: input.measurementId,
        response: text.slice(0, 500),
        status: response.status
      },
      source: input.source,
      storeId: input.storeId,
      ...(input.userId ? { userId: input.userId } : {})
    });

    return { ok: false, result: { message: problem, ok: false, reason: "failed" } };
  } catch {
    // Could not validate; let the real send decide.
    return { ok: true };
  }
}

function buildPayload(input: {
  clientId: string;
  events: Record<string, unknown>[];
  userData?: Record<string, unknown> | undefined;
}) {
  return {
    client_id: input.clientId,
    events: input.events,
    // GA4 rejects anything older than 72 hours; this is sent within seconds of
    // the order, but stamping it keeps the hit accurate if a retry is ever added.
    timestamp_micros: Date.now() * 1000,
    ...(input.userData && Object.keys(input.userData).length > 0
      ? { user_data: input.userData }
      : {})
  };
}

/**
 * The API secret can only travel as a query parameter — Google offers no header
 * form. Callers must never log the return value.
 */
function endpointFor(base: string, measurementId: string, secret: string) {
  const url = new URL(base);

  url.searchParams.set("measurement_id", measurementId);
  url.searchParams.set("api_secret", secret);

  return url.toString();
}

/**
 * GA4 needs a `client_id` to attribute the event to a user.
 *
 * The real one lives in the visitor's `_ga` cookie (`GA1.1.<id>.<timestamp>`),
 * which is a first-party cookie our own server can read — so when the caller has
 * the request, the server event stitches onto the same user as their browser
 * session instead of appearing as a second, sessionless visitor.
 *
 * Without it, a value derived from the order id: still a valid client id, stable
 * across retries and refreshes so one order is never counted as two users, and
 * unlinkable to anything outside this store.
 */
function resolveClientId(gaCookie: string | undefined, fallbackSeed: string) {
  const fromCookie = gaCookie?.trim().split(".").slice(-2).join(".");

  if (fromCookie && /^\d+\.\d+$/.test(fromCookie)) {
    return fromCookie;
  }

  const digest = createHash("sha256").update(fallbackSeed, "utf8").digest();

  return `${digest.readUInt32BE(0)}.${Math.floor(Date.now() / 1000)}`;
}

/**
 * Google's enhanced-conversion fields: SHA-256 of normalised values, never raw
 * PII. Sent only when the customer actually supplied them.
 */
function buildUserData(customer: { customerEmail: string | null; customerPhone: string | null }) {
  const email = customer.customerEmail?.trim().toLowerCase();
  const phone = normalizePhone(customer.customerPhone);

  return {
    ...(email ? { sha256_email_address: [sha256(email)] } : {}),
    ...(phone ? { sha256_phone_number: [sha256(phone)] } : {})
  };
}

/**
 * Google wants E.164, so `+` and country code included. Local Bangladeshi
 * numbers are stored as `01XXXXXXXXX`, so the 880 prefix is added rather than
 * hashing a number Google cannot match.
 */
function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (!digits) {
    return null;
  }

  if (digits.startsWith("880")) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `+88${digits}`;
  }

  if (digits.length === 10 && digits.startsWith("1")) {
    return `+880${digits}`;
  }

  return `+${digits}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function firstValidationMessage(text: string) {
  try {
    const parsed: unknown = JSON.parse(text);
    const messages = (parsed as { validationMessages?: unknown })?.validationMessages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }

    const description = (messages[0] as { description?: unknown })?.description;

    return typeof description === "string" && description.trim()
      ? description.trim()
      : "Google rejected the event payload.";
  } catch {
    // An unparseable body is not a validation failure.
    return null;
  }
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
