import { NotificationError } from "../notifications-errors";
import { readAlphaSmsSettings } from "../notifications.config";
import type { SmsProvider } from "./provider.types";

/**
 * Alpha SMS (`api.sms.net.bd`).
 *
 * Three things about this gateway are worth knowing before reading the code:
 *
 * 1. **The error is in the body, not the status.** A refused send still comes
 *    back HTTP 200 with a non-zero `error`. Checking `response.ok` would report
 *    every failure as a success.
 * 2. **There is no delivery webhook.** `report/request/{id}/` is pull-only, so a
 *    `request_id` is stored and looked up on demand rather than waited on.
 * 3. **A fresh account is locked to its own registered number** until the first
 *    balance recharge (error 421). Every code to any other number fails, which
 *    reads exactly like a broken integration unless it is named.
 *
 * The API key travels in the POST body rather than a query string so it stays
 * out of proxy and access logs.
 */

const sendUrl = "https://api.sms.net.bd/sendsms";
const balanceUrl = "https://api.sms.net.bd/user/balance/";
const requestTimeoutMs = 15_000;

type AlphaResponse = {
  data?: {
    balance?: string;
    request_id?: number | string;
    /** Undocumented, but the live balance response carries it. */
    validity?: string;
  } | null;
  error?: number;
  msg?: string;
};

export const alphaSmsProvider: SmsProvider = {
  isConfigured() {
    return readAlphaSmsSettings() !== null;
  },
  key: "alpha",
  label: "Alpha SMS",
  async readAccountStatus() {
    const settings = requireSettings();
    const body = await call(balanceUrl, { api_key: settings.apiKey });
    const balance = Number.parseFloat(String(body.data?.balance ?? ""));
    // `2026-11-19 00:00:00`, with no zone given. Read as UTC: it is shown as a
    // date, and a few hours either way does not change what it tells an admin.
    const validity = body.data?.validity
      ? new Date(`${body.data.validity.replace(" ", "T")}Z`)
      : null;

    return {
      balance: Number.isFinite(balance) ? balance : null,
      validUntil: validity && !Number.isNaN(validity.getTime()) ? validity : null
    };
  },
  async send(input) {
    const settings = requireSettings();
    const params: Record<string, string> = {
      api_key: settings.apiKey,
      msg: input.message,
      to: input.to
    };

    try {
      const body = await call(sendUrl, {
        ...params,
        ...(settings.senderId === null ? {} : { sender_id: settings.senderId })
      });

      return { providerMessageId: readRequestId(body) };
    } catch (error) {
      // An unapproved sender ID is rejected outright. Falling back to an
      // unbranded send is strictly better than not delivering the code at all,
      // and it is the state every account is in before approval comes through.
      if (settings.senderId !== null && isProviderCode(error, "413")) {
        console.warn(
          `[sms] Alpha SMS rejected sender ID "${settings.senderId}" — resending unbranded. Get the ID approved or clear SMS_SENDER_ID.`
        );

        return { providerMessageId: readRequestId(await call(sendUrl, params)) };
      }

      throw error;
    }
  }
};

function requireSettings() {
  const settings = readAlphaSmsSettings();

  if (!settings) {
    throw new NotificationError("CONFIG", "ALPHA_SMS_API_KEY is not set.");
  }

  return settings;
}

async function call(url: string, params: Record<string, string>) {
  let response: Response;

  try {
    response = await fetch(url, {
      body: new URLSearchParams(params),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST",
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
  } catch (error) {
    throw new NotificationError("TRANSPORT", "Alpha SMS did not respond.", { cause: error });
  }

  const raw = await response.text();
  let body: AlphaResponse;

  try {
    body = JSON.parse(raw) as AlphaResponse;
  } catch (error) {
    // A gateway answering with HTML is almost always an outage page or a
    // captive portal, and the raw text is what makes that recognisable.
    throw new NotificationError(
      "TRANSPORT",
      `Alpha SMS returned something that is not JSON (HTTP ${response.status}): ${raw.slice(0, 200)}`,
      { cause: error }
    );
  }

  if (body.error !== 0) {
    throw describeAlphaError(body);
  }

  return body;
}

function readRequestId(body: AlphaResponse) {
  const id = body.data?.request_id;

  return id === undefined || id === null ? null : String(id);
}

/**
 * The gateway's documented codes, sorted by who has to do something about it.
 */
function describeAlphaError(body: AlphaResponse) {
  const code = String(body.error ?? "unknown");
  const said = body.msg?.trim() ? ` (${body.msg.trim()})` : "";
  const options = { providerCode: code };

  switch (body.error) {
    case 403:
    case 405:
      return new NotificationError("AUTH", `Alpha SMS rejected the API key${said}.`, options);
    case 410:
    case 411:
      return new NotificationError(
        "NO_BALANCE",
        `The Alpha SMS account is expired or suspended${said}. No message can be sent until it is restored.`,
        options
      );
    case 417:
      return new NotificationError(
        "NO_BALANCE",
        `The Alpha SMS account is out of balance${said}. Recharge it — nothing will send until then.`,
        options
      );
    case 421:
      return new NotificationError(
        "RESTRICTED",
        "Alpha SMS only allows messages to the account's own registered number until the first balance recharge. Recharge the account to message anyone else.",
        options
      );
    case 413:
      return new NotificationError(
        "CONFIG",
        `Alpha SMS rejected the sender ID${said}. It has to be approved by them before it can be used.`,
        options
      );
    case 400:
    case 412:
    case 414:
    case 415:
      return new NotificationError("CONFIG", `Alpha SMS rejected the request${said}.`, options);
    case 416:
      return new NotificationError(
        "INVALID_RECIPIENT",
        `Alpha SMS found no valid number to send to${said}.`,
        options
      );
    case 420:
      return new NotificationError(
        "BLOCKED",
        `Alpha SMS blocked the message content${said}.`,
        options
      );
    case 409:
      return new NotificationError(
        "TRANSPORT",
        `Alpha SMS reported a server-side error${said}.`,
        options
      );
    default:
      return new NotificationError("UNKNOWN", `Alpha SMS error ${code}${said}.`, options);
  }
}

function isProviderCode(error: unknown, code: string) {
  return error instanceof NotificationError && error.providerCode === code;
}
