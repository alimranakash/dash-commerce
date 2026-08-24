import { NotificationError } from "../notifications-errors";
import type { SmsProvider } from "./provider.types";

/**
 * BulkSMS BD (`bulksmsbd.net`).
 *
 * Four things about this gateway are worth knowing before reading the code:
 *
 * 1. **The outcome is a code in the body, never the HTTP status.** A refused
 *    send comes back 200 with `response_code` set to something other than 202.
 * 2. **A sender ID is mandatory.** Unlike Alpha SMS there is no unbranded
 *    fallback to drop to — a missing or unapproved ID is 1002/1003 and the
 *    message simply does not go. Nothing here retries it; the error says so.
 * 3. **The number must carry its country code**, `88017XXXXXXXX`, while
 *    everything upstream of here speaks the local `01XXXXXXXXX` form.
 * 4. **A masking sender ID only carries Bengali text** (1012). English on a
 *    masking ID is refused by the operator, not by this code.
 *
 * The API key travels in the POST body rather than the documented query string
 * so it stays out of proxy and access logs, and the endpoints are called over
 * HTTPS for the same reason — the published examples still say `http://`.
 */

const sendUrl = "https://bulksmsbd.net/api/smsapi";
const balanceUrl = "https://bulksmsbd.net/api/getBalanceApi";
const requestTimeoutMs = 15_000;

/** The gateway's one success code. Everything else in its table is a failure. */
const submitted = 202;

type BulkSmsBdResponse = {
  balance?: number | string;
  error_message?: string;
  message_id?: number | string;
  response_code?: number | string;
  success_message?: string;
};

export const bulkSmsBdProvider: SmsProvider = {
  key: "bulksmsbd",
  label: "BulkSMS BD",
  async readAccountStatus(credentials) {
    const body = await call(
      balanceUrl,
      { api_key: credentials.apiKey },
      (reply) => reply.balance !== undefined
    );
    const balance = Number.parseFloat(String(body.balance ?? ""));

    return {
      balance: Number.isFinite(balance) ? balance : null,
      // The account sells credit outright with no expiry published beside it.
      // Code 1006 is the only sign one exists, and it arrives as a failed send.
      validUntil: null
    };
  },
  async send(input, credentials) {
    const body = await call(sendUrl, {
      api_key: credentials.apiKey,
      message: input.message,
      number: toGatewayNumber(input.to),
      // Sent even when blank. There is nothing to fall back to, and an empty
      // value gets 1002 back — which names the problem far better than this
      // adapter guessing at one would.
      senderid: credentials.senderId ?? "",
      // The documented value, and the only one worth sending: the gateway reads
      // the body itself to decide what it is carrying — which is exactly what
      // code 1012 says when it refuses English on a masking sender ID.
      type: "text"
    });

    return { providerMessageId: readMessageId(body) };
  }
};

async function call(
  url: string,
  params: Record<string, string>,
  /**
   * Accepts a reply that carries what was asked for but no `response_code`
   * beside it. The balance endpoint answers with the figure alone often enough
   * that insisting on the envelope would report a working account as unreadable.
   */
  answered?: (body: BulkSmsBdResponse) => boolean
) {
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
    throw new NotificationError("TRANSPORT", "BulkSMS BD did not respond.", { cause: error });
  }

  const raw = (await response.text()).trim();
  const body = parseBody(raw, response.status);
  const code = readCode(body);

  if (code !== submitted && !(code === null && answered?.(body) === true)) {
    throw describeBulkSmsBdError(body, raw);
  }

  return body;
}

/**
 * The gateway answers JSON in the normal case, but drops to a bare code often
 * enough that demanding JSON would turn a readable `1007` into a parser error.
 * Anything else — an outage page, a captive portal — is refused along with the
 * text it actually sent, which is the only thing that makes those recognisable.
 */
function parseBody(raw: string, status: number): BulkSmsBdResponse {
  if (/^\d+$/.test(raw)) {
    return { response_code: raw };
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed === "number" || typeof parsed === "string") {
      return { response_code: parsed };
    }

    if (parsed !== null && typeof parsed === "object") {
      return parsed as BulkSmsBdResponse;
    }
  } catch {
    // Falls through to the same refusal as any other unreadable reply.
  }

  throw new NotificationError(
    "TRANSPORT",
    `BulkSMS BD returned something unreadable (HTTP ${status}): ${raw.slice(0, 200)}`
  );
}

function readCode(body: BulkSmsBdResponse) {
  const code = Number.parseInt(String(body.response_code ?? ""), 10);

  return Number.isNaN(code) ? null : code;
}

function readMessageId(body: BulkSmsBdResponse) {
  const id = body.message_id;

  return id === undefined || id === null || id === "" ? null : String(id);
}

/**
 * The gateway wants `88017XXXXXXXX`. Everything upstream carries the canonical
 * local `01XXXXXXXXX` that `normalizeBangladeshPhone` produces, so the country
 * code is put back on here — and a number that already has one is left alone.
 */
function toGatewayNumber(to: string) {
  const digits = to.replace(/\D/g, "");

  if (digits.startsWith("880")) {
    return digits;
  }

  return digits.startsWith("0") ? `880${digits.slice(1)}` : `880${digits}`;
}

/**
 * The gateway's documented codes, sorted by who has to do something about it.
 */
function describeBulkSmsBdError(body: BulkSmsBdResponse, raw: string) {
  const code = readCode(body);
  const label = code === null ? "unknown" : String(code);
  const said = detail(body, raw);
  const options = { providerCode: label };

  switch (code) {
    case 1001:
      return new NotificationError(
        "INVALID_RECIPIENT",
        `BulkSMS BD rejected the number${said}.`,
        options
      );
    case 1002:
    case 1013:
    case 1014:
    case 1015:
      return new NotificationError(
        "CONFIG",
        `BulkSMS BD rejected the sender ID${said}. It has to be approved and routed to a gateway on their side before it can be used.`,
        options
      );
    case 1003:
      return new NotificationError(
        "CONFIG",
        `BulkSMS BD is missing something the request has to carry${said} — with an API key already set, that is almost always the sender ID.`,
        options
      );
    case 1005:
      return new NotificationError(
        "TRANSPORT",
        `BulkSMS BD reported a server-side error${said}.`,
        options
      );
    case 1006:
      return new NotificationError(
        "NO_BALANCE",
        `The BulkSMS BD account has no valid balance period left${said}. Recharge it — nothing will send until then.`,
        options
      );
    case 1007:
      return new NotificationError(
        "NO_BALANCE",
        `The BulkSMS BD account is out of balance${said}. Recharge it — nothing will send until then.`,
        options
      );
    case 1011:
      return new NotificationError(
        "AUTH",
        `BulkSMS BD did not recognise the API key${said}.`,
        options
      );
    case 1012:
      return new NotificationError(
        "BLOCKED",
        `BulkSMS BD only carries this masking sender ID with Bengali text${said}. Send English through a non-masking sender ID instead.`,
        options
      );
    case 1016:
    case 1017:
    case 1019:
    case 1020:
    case 1021:
      return new NotificationError(
        "CONFIG",
        `BulkSMS BD has no active price set up for this sender ID${said}. Only they can fix it — contact their support.`,
        options
      );
    case 1018:
      return new NotificationError(
        "AUTH",
        `The BulkSMS BD account is disabled${said}. Nothing will send until they re-enable it.`,
        options
      );
    case 1031:
      return new NotificationError(
        "AUTH",
        `The BulkSMS BD account is not verified yet${said}. Their support has to verify it before it can send anything.`,
        options
      );
    case 1032:
      return new NotificationError(
        "AUTH",
        `BulkSMS BD does not have this server's IP address whitelisted${said}. Add the deployed server's outbound IP in their panel.`,
        options
      );
    default:
      return new NotificationError("UNKNOWN", `BulkSMS BD error ${label}${said}.`, options);
  }
}

/**
 * What the gateway said, when it said anything. A reply with no code at all gets
 * its raw text instead — without that there would be nothing to go on.
 */
function detail(body: BulkSmsBdResponse, raw: string) {
  const said = body.error_message?.trim() || body.success_message?.trim();

  if (said) {
    return ` (${said})`;
  }

  return readCode(body) === null && raw ? ` (${raw.slice(0, 120)})` : "";
}
