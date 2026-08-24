/**
 * The copy for everything the platform sends. Kept away from the transports so
 * that adding a message means writing words, not plumbing.
 *
 * The SMS body stays inside plain ASCII on purpose. A Bangla character forces
 * the whole message into Unicode encoding, where a segment is 70 characters
 * instead of 160 — the same code then costs two or three times as much to send,
 * multiplied by every sign-up.
 */

const brand = "StoreIM";

/**
 * The opening sentence is not free wording. Bangladeshi gateways route OTP
 * traffic on the shape `Your {Brand} OTP is XXXX` — BulkSMS BD publishes it as a
 * requirement — and a code that arrives in some other phrasing can be held or
 * dropped by the operator. Everything after that first full stop is ours.
 */
export function otpCodeSms(input: { code: string; expiresInMinutes: number }) {
  return `Your ${brand} OTP is ${input.code}. Valid for ${input.expiresInMinutes} minutes. Do not share it with anyone.`;
}

/**
 * The text a customer gets the moment their order goes through.
 *
 * Kept to one segment with a long store name and a five-figure total, because
 * the seller pays per segment and this one goes out on every single order — the
 * highest-volume message the platform sends.
 */
export function orderConfirmationSms(input: {
  currency: string;
  orderNumber: string;
  storeName: string;
  total: number;
}) {
  const store = input.storeName.length > 24 ? `${input.storeName.slice(0, 23)}.` : input.storeName;
  const total = Math.round(input.total).toLocaleString("en-US");

  return `Order ${input.orderNumber} confirmed at ${store}. Total ${input.currency} ${total}. We will call you before delivery. Thank you!`;
}

/**
 * The longest text a seller may write, and the tokens they may write into it.
 *
 * The cap is deliberately loose — a little past the 306 characters two joined
 * GSM segments hold — because the seller is the one paying for the extra
 * segment. The number is here to stop a runaway paste, not to police their
 * words; the settings page shows them the running cost instead.
 */
export const CUSTOM_ORDER_SMS_MAX_LENGTH = 320;
export const CUSTOM_ORDER_SMS_PLACEHOLDERS = ["{name}", "{order}", "{store}", "{total}"] as const;

/**
 * The seller's own text to the customer, sent alongside the confirmation above.
 *
 * Placeholders are matched without regard to case, because a seller typing
 * `{Order}` meant the order number and being sent their own braces back is the
 * kind of mistake they only find out about from an annoyed customer. Anything
 * that is not a placeholder is left exactly as written, braces included.
 */
export function customOrderSms(input: {
  currency: string;
  customerName: string;
  message: string;
  orderNumber: string;
  storeName: string;
  total: number;
}) {
  const values: Record<string, string> = {
    name: input.customerName,
    order: input.orderNumber,
    store: input.storeName,
    total: `${input.currency} ${Math.round(input.total).toLocaleString("en-US")}`
  };

  return input.message
    .replace(
      /\{(name|order|store|total)\}/gi,
      (token, key: string) => values[key.toLowerCase()] ?? token
    )
    .trim();
}

export function otpCodeEmail(input: { code: string; expiresInMinutes: number }) {
  const text = [
    `Your ${brand} verification code is ${input.code}.`,
    "",
    `It stops working in ${input.expiresInMinutes} minutes.`,
    "",
    `If you did not ask to create a ${brand} account, you can ignore this message — nothing was created.`
  ].join("\n");

  return {
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#20212c;line-height:1.6">
  <p style="margin:0 0 20px">Your ${brand} verification code is:</p>
  <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:6px">${input.code}</p>
  <p style="margin:0 0 20px;color:#565762">It stops working in ${input.expiresInMinutes} minutes.</p>
  <p style="margin:0;color:#74758a;font-size:13px">If you did not ask to create a ${brand} account, you can ignore this message &mdash; nothing was created.</p>
</div>`,
    // The code is in the subject so it is readable from a notification without
    // opening anything, which is how most people will actually use it.
    subject: `${input.code} is your ${brand} verification code`,
    text
  };
}
