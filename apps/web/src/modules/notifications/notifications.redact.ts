import type { MessageTemplateKey } from "./notifications.types";

/**
 * What a message may say about itself anywhere it is written down — the
 * server log, the delivery log, an error a seller or admin is shown.
 *
 * Every one of those is read by more people, and kept longer, than the
 * message itself, so each is told less: a recipient masked to its last three
 * characters, no body at all for a message that carries a code, and free text
 * — a gateway's reply, an error — with anything that could be a credential, a
 * number, a code or an address taken out. A gateway, a proxy or a captive
 * portal can echo the whole request back, `api_key=…&number=…&message=…`
 * included, so the text is never trusted to be clean. Short digit runs and
 * the words around them survive, because a gateway's own error code (`1007`)
 * and its sentence are what make a failure line worth reading.
 *
 * Applied before anything is persisted, and again when the admin console
 * renders a row, so a row written before these rules existed is shown under
 * them too. Pure, so the rules can be checked without a database.
 */

/** All but the last three characters hidden — enough to tell two failures apart. */
export function maskRecipient(recipient: string) {
  return recipient.length <= 3
    ? "***"
    : `${"*".repeat(recipient.length - 3)}${recipient.slice(-3)}`;
}

const SECRET_NAMES =
  "api[_-]?key|apikey|access[_-]?token|auth[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|pwd|pass|secret|token|signature|sig|key";

/** `https://user:secret@host` — the credentials half of a URL. */
const URL_USERINFO = /(\bhttps?:\/\/)[^\s/@"'<>]+@/gi;
/** A URL keeps its scheme, host and path; everything after `?` goes, since that is where requests carry keys. */
const URL_QUERY = /(\bhttps?:\/\/[^\s?#"'<>]+)\?[^\s"'<>]*/gi;
/** `Authorization: Bearer …`, `"authorization":"Basic …"`, `proxy-authorization=…`. */
const AUTHORIZATION =
  /\b((?:proxy-)?authorization)(["']?\s*[:=]\s*["']?)(?:(?:bearer|basic|digest|token)\s+)?[^\s",;&}]+/gi;
const BEARER = /\b(bearer)\s+[A-Za-z0-9._~+/=-]+/gi;
/** `"api_key": "…"` in a JSON echo. */
const SECRET_JSON = new RegExp(`("(?:${SECRET_NAMES})"\\s*:\\s*)"[^"]*"`, "gi");
/** `api_key=…` in a form body or a query string. */
const SECRET_ASSIGNMENT = new RegExp(`(^|[^A-Za-z0-9_-])(${SECRET_NAMES})=[^&\\s"'<>,;]*`, "gi");
/** `X-API-Key: …`, `password: …` — only the names that cannot be ordinary prose. */
const SECRET_HEADER =
  /(^|[^A-Za-z0-9_-])((?:x-)?api[_-]?key|apikey|access[_-]?token|auth[_-]?token|client[_-]?secret|password)(\s*:\s*)[^\s",;]+/gi;
/** `message=…` in an echoed form body: the text of the SMS itself. */
const MESSAGE_ASSIGNMENT = /(^|[^A-Za-z0-9_-])(message|msg|text|body|sms|content)=[^&\s"'<>]*/gi;
const EMAIL_ADDRESS = /[^\s@<>"'(),;:/[\]]+@[^\s@<>"'(),;:/[\]]+\.[^\s@<>"'(),;:/[\]]+/g;
/** Six or more digits, with the spaces, dashes and leading plus a number is written with. */
const LONG_DIGIT_RUN = /\+?\d(?:[\s-]?\d){5,}/g;
/** A long run of letters and digits together — the shape of a key or a token nobody labelled. */
const OPAQUE_TOKEN = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{24,}\b/g;

/**
 * Free text bound for a log or a screen, with credentials, numbers, codes and
 * addresses taken out. `secrets` are the credentials this server actually
 * holds for the send — removed verbatim and URL-encoded, wherever they
 * appear, whether or not anything labels them. Idempotent.
 */
export function redactLogText(text: string, secrets: readonly (string | null | undefined)[] = []) {
  let redacted = text;

  for (const secret of secrets) {
    if (secret && secret.length >= 4) {
      for (const spelling of new Set([secret, encodeURIComponent(secret)])) {
        redacted = redacted.split(spelling).join("[secret]");
      }
    }
  }

  return (
    redacted
      .replace(URL_USERINFO, "$1[secret]@")
      .replace(URL_QUERY, "$1?[redacted]")
      .replace(AUTHORIZATION, "$1$2[secret]")
      .replace(BEARER, "$1 [secret]")
      .replace(SECRET_JSON, '$1"[secret]"')
      .replace(SECRET_ASSIGNMENT, "$1$2=[secret]")
      .replace(SECRET_HEADER, "$1$2$3[secret]")
      .replace(MESSAGE_ASSIGNMENT, "$1$2=[redacted]")
      .replace(EMAIL_ADDRESS, "[email]")
      // A token before digits, or the digit rule would cut a hex key in two and
      // leave most of it standing.
      .replace(OPAQUE_TOKEN, "[secret]")
      .replace(LONG_DIGIT_RUN, "[number]")
  );
}

/**
 * An unexpected error as the server log may show it: the stack, so it can
 * still be traced, with the same things taken out — a database error can
 * quote the row it refused, phone number and all.
 */
export function errorForLog(error: unknown) {
  return redactLogText(error instanceof Error ? (error.stack ?? error.message) : String(error));
}

/**
 * A delivery-log row as it may be stored or shown: the recipient masked, the
 * error code and message redacted and the message capped. Idempotent, so the
 * admin console can run a stored row through it again.
 */
export function redactDeliveryRow<
  Row extends { errorCode: string | null; errorMessage: string | null; recipient: string }
>(row: Row, secrets: readonly (string | null | undefined)[] = []): Row {
  return {
    ...row,
    errorCode: row.errorCode === null ? null : redactLogText(row.errorCode, secrets),
    errorMessage:
      row.errorMessage === null ? null : redactLogText(row.errorMessage, secrets).slice(0, 500),
    recipient: maskRecipient(row.recipient)
  };
}

/** Templates whose body is itself the secret. */
const SECRET_TEMPLATES: ReadonlySet<MessageTemplateKey> = new Set<MessageTemplateKey>(["otp_code"]);

/** The body of an unsent message as the server log may show it. */
export function previewForLog(template: MessageTemplateKey, preview: string) {
  return SECRET_TEMPLATES.has(template)
    ? "(body withheld: it carries a verification code)"
    : redactLogText(preview);
}
