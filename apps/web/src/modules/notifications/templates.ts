/**
 * The copy for everything the platform sends. Kept away from the transports so
 * that adding a message means writing words, not plumbing.
 *
 * The SMS body stays inside plain ASCII on purpose. A Bangla character forces
 * the whole message into Unicode encoding, where a segment is 70 characters
 * instead of 160 — the same code then costs two or three times as much to send,
 * multiplied by every sign-up.
 */

const brand = "Dash";

export function otpCodeSms(input: { code: string; expiresInMinutes: number }) {
  return `${brand} verification code: ${input.code}. Valid for ${input.expiresInMinutes} minutes. Do not share it with anyone.`;
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
