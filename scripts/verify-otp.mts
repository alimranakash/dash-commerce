/**
 * OTP check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * shared verification-code layer — sign-up, password reset, contact change,
 * the cash-on-delivery confirmation and the loyalty code all go through
 * `modules/auth/otp`. It needs no database.
 *
 * The *store binding* and *ceiling* checks run `otp.service.ts`'s pure parts
 * for real: which purposes belong to a store, and which hourly ceilings one
 * more send must stay under. The *lookup* checks read the service and the
 * repository as text, because "every lookup of a store's code is narrowed by
 * that store" is true of the file or it is not.
 *
 * The *privacy* checks run `notifications.redact.ts` for real against the
 * actual code templates, then walk every console call in the auth,
 * notification, checkout and loyalty code and refuse any that interpolates
 * something other than a known-safe value or a redacted one.
 *
 * Covers:
 * - exactly CHECKOUT and LOYALTY codes belonging to a store, and naming the
 *   wrong store (or none) being a programming error rather than a lookup;
 * - a store's challenge found, resent, counted and verified only at that store;
 * - a store's own 5/hour, under a global 10/hour per number across every
 *   store and sign-up, and sign-up's 5/hour still counting every code;
 * - the loyalty code being the only deferred send, its delivery never
 *   throwing, and a development build echoing a deferred code on every ticket;
 * - sign-up, reset and contact change unchanged: synchronous, unscoped, and a
 *   reset still suppressed for an unknown account;
 * - no code, full number or email address reaching the server log.
 *
 * Run with: npm run verify:otp
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  canEchoOtpCode,
  otpDeliveryResult,
  responseDevCode
} from "../apps/web/src/modules/auth/otp/otp-delivery";
import type { OtpSendScope } from "../apps/web/src/modules/auth/otp/otp.repository";
import {
  firstExceededOtpCeiling,
  otpChallengeStore,
  otpSendCeilings
} from "../apps/web/src/modules/auth/otp/otp.service";
import {
  NotificationError,
  toRedactedNotificationError
} from "../apps/web/src/modules/notifications/notifications-errors";
import {
  errorForLog,
  maskRecipient,
  previewForLog,
  redactDeliveryRow,
  redactLogText
} from "../apps/web/src/modules/notifications/notifications.redact";
import { otpCodeEmail, otpCodeSms } from "../apps/web/src/modules/notifications/templates";

const ROOT = process.cwd();
const WEB = join(ROOT, "apps", "web", "src");
const MODULES = join(WEB, "modules");

const source = {
  adminMessaging: read(join(MODULES, "admin", "admin-messaging.service.ts")),
  checkoutVerification: read(join(MODULES, "checkout", "checkout-verification.service.ts")),
  contactChange: read(join(MODULES, "auth", "contact-change.service.ts")),
  delivery: read(join(MODULES, "auth", "otp", "otp-delivery.ts")),
  deployUnit: read(join(ROOT, "deploy", "dash-web.service")),
  loyalty: read(join(MODULES, "loyalty", "loyalty.service.ts")),
  nextConfig: read(join(ROOT, "apps", "web", "next.config.mjs")),
  notifications: read(join(MODULES, "notifications", "notifications.service.ts")),
  webPackage: read(join(ROOT, "apps", "web", "package.json")),
  passwordReset: read(join(MODULES, "auth", "password-reset.service.ts")),
  registration: read(join(MODULES, "auth", "registration.service.ts")),
  repository: read(join(MODULES, "auth", "otp", "otp.repository.ts")),
  service: read(join(MODULES, "auth", "otp", "otp.service.ts"))
};

let failures = 0;

function read(file: string) {
  return readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

/** The text with its comments taken out, for counts that must not include prose. */
function code(text: string) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function throws(work: () => unknown) {
  try {
    work();
    return false;
  } catch {
    return true;
  }
}

/** One function, from its signature to its closing brace at the margin. */
function functionBody(text: string, name: string) {
  return (
    new RegExp(`(?:export )?(?:async )?function ${name}\\b[\\s\\S]*?\\n\\}(?=\\n|$)`).exec(
      text
    )?.[0] ?? ""
  );
}

/** Every call to `name(...)` in the text, each up to its closing `});` or `);`. */
function callsTo(text: string, name: string) {
  return [...text.matchAll(new RegExp(`${name}\\(\\{[\\s\\S]*?\\}\\)`, "g"))].map(
    (match) => match[0]
  );
}

console.log("\n=== Store binding ===");

check(
  "a CHECKOUT or LOYALTY code belongs to the store that asked for it",
  otpChallengeStore("CHECKOUT", "store_a") === "store_a" &&
    otpChallengeStore("LOYALTY", "store_b") === "store_b"
);
check(
  "a store's code with no store named is refused, not looked up by number alone",
  throws(() => otpChallengeStore("CHECKOUT", null)) &&
    throws(() => otpChallengeStore("LOYALTY", undefined))
);
check(
  "an account code tied to a store is refused, and without one it stays unscoped",
  (["CONTACT_CHANGE", "LOGIN", "PASSWORD_RESET", "REGISTRATION"] as const).every(
    (purpose) =>
      throws(() => otpChallengeStore(purpose, "store_a")) &&
      otpChallengeStore(purpose, null) === null
  )
);
check(
  "exactly two purposes belong to a store",
  source.service.includes('new Set<OtpPurpose>(["CHECKOUT", "LOYALTY"])')
);

const openBody = functionBody(source.service, "openOtpChallenge");
const verifyBody = functionBody(source.service, "verifyOtpChallenge");
check(
  "requesting, resending and the cooldown all find the challenge at this store only",
  openBody.includes("const storeId = otpChallengeStore(input.purpose, input.storeId);") &&
    openBody.includes("findLatestOpenOtpChallenge(value, input.purpose, storeId)")
);
check(
  "verifying finds the challenge at this store before an attempt is counted",
  /findLatestOpenOtpChallenge\(\s*value,\s*input\.purpose,\s*otpChallengeStore\(input\.purpose, input\.storeId\)\s*\)/.test(
    verifyBody
  ) &&
    verifyBody.indexOf("findLatestOpenOtpChallenge(") <
      verifyBody.indexOf("recordOtpChallengeAttempt(")
);
check(
  "the repository narrows by store whenever one is named, and only then",
  /\.\.\.\(storeId === null \? \{\} : storeWhere\(storeId\)\)/.test(
    functionBody(source.repository, "findLatestOpenOtpChallenge")
  ) && /payload: \{\s*equals: storeId,\s*path: \["storeId"\]\s*\}/.test(source.repository)
);
check(
  "a store's challenge carries its store and nothing a caller could add",
  /if \(storeId === null\) \{\s*return payload \?\? null;\s*\}\s*if \(payload !== undefined\) \{\s*throw new Error/.test(
    functionBody(source.service, "challengePayload")
  ) && functionBody(source.service, "challengePayload").includes("return { storeId };")
);

console.log("\n=== Hourly ceilings ===");

const accountCeilings = otpSendCeilings({
  identifier: "01712345678",
  ipAddress: "203.0.113.9",
  storeId: null
});
const storeCeilings = otpSendCeilings({
  identifier: "01712345678",
  ipAddress: "203.0.113.9",
  storeId: "store_a"
});
check(
  "sign-up and the other account codes keep 5 an hour per handle and 20 per network",
  JSON.stringify(accountCeilings) ===
    JSON.stringify([
      { limit: 5, scope: { identifier: "01712345678" } },
      { limit: 20, scope: { ipAddress: "203.0.113.9" } }
    ]),
  JSON.stringify(accountCeilings)
);
check(
  "without an address only the per-number ceilings apply",
  JSON.stringify(otpSendCeilings({ identifier: "01712345678", ipAddress: null, storeId: null })) ===
    JSON.stringify([{ limit: 5, scope: { identifier: "01712345678" } }])
);
check(
  "a store's code answers to that store's 5 an hour, then the global 10 per number, then the network's 20",
  JSON.stringify(storeCeilings) ===
    JSON.stringify([
      { limit: 5, scope: { identifier: "01712345678", storeId: "store_a" } },
      { limit: 10, scope: { identifier: "01712345678" } },
      { limit: 20, scope: { ipAddress: "203.0.113.9" } }
    ]),
  JSON.stringify(storeCeilings)
);
check(
  "one store's ceiling is below the global one, so no single shop can use up a number's hour",
  (storeCeilings[0]?.limit ?? Infinity) < (storeCeilings[1]?.limit ?? 0)
);
check(
  "a store's own count is narrowed to that store, and only when one is named",
  /\.\.\.\(scope\.storeId === undefined \? \{\} : storeWhere\(scope\.storeId\)\)/.test(
    functionBody(source.repository, "scopeWhere")
  )
);
check(
  "the per-number counts span every purpose — sign-up's 5 still counts a store's codes",
  !/purpose/.test(functionBody(source.repository, "scopeWhere")) &&
    /\.\.\.scopeWhere\(scope\)/.test(functionBody(source.repository, "countOtpSendsSince")) &&
    /\.\.\.scopeWhere\(scope\)/.test(functionBody(source.repository, "findOldestOtpSendSince"))
);
check(
  "a refusal says the same whichever per-number ceiling was hit",
  /ceiling\.scope\.ipAddress === undefined\s*\?\s*"Too many codes have gone to this address or number in the last hour\. Try again later\."/.test(
    functionBody(source.service, "assertSendAllowance")
  )
);

console.log("\n=== Deferred delivery ===");

const deferredBody = functionBody(source.service, "requestDeferredOtpChallenge");
check(
  "a deferred code's delivery never throws into the caller's after(), and a failure is still logged",
  (() => {
    const closure = /deliver: async \(\) => \{([\s\S]*?)\n {4}\},\n/.exec(deferredBody)?.[1] ?? "";

    return (
      /^\s*try \{\s*await opened\.deliver\(\);\s*\} catch \(error\) \{/.test(closure) &&
      /console\.warn\(\s*`\[otp\] a code sent after the reply did not go out: \$\{errorForLog\(/.test(
        closure
      ) &&
      !/\bthrow\b/.test(closure)
    );
  })()
);
check(
  "the deferred ticket is written without waiting on the gateway",
  (deferredBody.match(/opened\.deliver\(\)/g) ?? []).length === 1 &&
    !/^\s*await opened\.deliver/m.test(deferredBody.replace(/deliver: async[\s\S]*?\},\n/, ""))
);
check(
  "a deferred ticket echoes its code only where the one echo gate allows",
  deferredBody.includes("...(canEchoOtpCode() ? { devCode: opened.code } : {})") &&
    (source.service.match(/devCode: /g) ?? []).length === 2
);
check(
  "an ordinary request still waits for the gateway, and echoes only what delivery reported",
  /input\.suppressDelivery\s*\?\s*\{ delivered: false \}\s*:\s*await opened\.deliver\(\);/.test(
    functionBody(source.service, "requestOtpChallenge")
  ) &&
    functionBody(source.service, "requestOtpChallenge").includes(
      "...(delivery.devCode === undefined ? {} : { devCode: delivery.devCode })"
    )
);
check(
  "a production gateway refusal is still an error for the synchronous flows",
  source.delivery.includes("throw toOtpDeliveryError(error, input.channel);")
);
check(
  "the loyalty code is the only deferred send",
  sourceFiles(WEB)
    .filter((file) => read(file).includes("requestDeferredOtpChallenge("))
    .map((file) => file.slice(WEB.length + 1).replace(/\\/g, "/"))
    .sort()
    .join(",") === "modules/auth/otp/otp.service.ts,modules/loyalty/loyalty.service.ts"
);

console.log("\n=== Callers ===");

check(
  "the cash-on-delivery code is requested and checked at its own store",
  callsTo(source.checkoutVerification, "requestOtpChallenge").every((call) =>
    /\bstoreId\b/.test(call)
  ) &&
    /purpose: "CHECKOUT",\s*storeId\s*\}\)/.test(
      callsTo(source.checkoutVerification, "verifyOtpChallenge").join("\n")
    )
);
check(
  "the loyalty code is requested and checked at its own store",
  /purpose: "LOYALTY",\s*storeId\s*\}\)/.test(
    callsTo(source.loyalty, "requestDeferredOtpChallenge").join("\n")
  ) &&
    /purpose: "LOYALTY",\s*storeId\s*\}\)/.test(
      callsTo(source.loyalty, "verifyOtpChallenge").join("\n")
    )
);
check(
  "sign-up, password reset and contact change name no store",
  [source.registration, source.passwordReset, source.contactChange].every(
    (text) =>
      [...callsTo(text, "requestOtpChallenge"), ...callsTo(text, "verifyOtpChallenge")].length >=
        2 &&
      [...callsTo(text, "requestOtpChallenge"), ...callsTo(text, "verifyOtpChallenge")].every(
        (call) => !/\bstoreId\b/.test(call)
      )
  )
);
check(
  "password reset still goes through every motion for an unknown account",
  source.passwordReset.includes("suppressDelivery: user === null")
);

console.log("\n=== Log redaction ===");

check(
  "a masked recipient keeps only its last three characters",
  maskRecipient("01712345678") === "********678" &&
    maskRecipient("shopper@example.com") === "****************com" &&
    maskRecipient("678") === "***"
);

const spellings = [
  "01712345678",
  "+8801712345678",
  "8801712345678",
  "+880 1712-345678",
  "017-1234-5678"
];
check(
  "no spelling of a phone number survives redaction",
  spellings.every(
    (phone) =>
      !/\d{6,}|\d[\s-]\d{3,}[\s-]?\d{3,}/.test(redactLogText(`gateway said ${phone} is invalid`))
  ),
  spellings.map((phone) => redactLogText(phone)).join(" | ")
);
check(
  "a six-digit code and an email address are redacted; a gateway's own short code is kept",
  redactLogText("BulkSMS BD error 1007 (HTTP 403): code 482913 for shopper@example.com") ===
    "BulkSMS BD error 1007 (HTTP 403): code [number] for [email]",
  redactLogText("BulkSMS BD error 1007 (HTTP 403): code 482913 for shopper@example.com")
);
check(
  "an unsent SMS code's body is withheld from the log entirely",
  (() => {
    const preview = previewForLog("otp_code", otpCodeSms({ code: "482913", expiresInMinutes: 5 }));

    return !preview.includes("482913") && preview.includes("withheld");
  })()
);
check(
  "an unsent email code's body is withheld too",
  (() => {
    const mail = otpCodeEmail({ code: "482913", expiresInMinutes: 10 });

    return !previewForLog("otp_code", `${mail.subject} — ${mail.text}`).includes("482913");
  })()
);
check(
  "other bodies are logged with their numbers taken out",
  previewForLog("order_confirmation", "Order #1042 confirmed. We will call 01712345678.") ===
    "Order #1042 confirmed. We will call [number]."
);
check(
  "an unexpected error keeps its trace but not the number it quoted",
  (() => {
    const logged = errorForLog(
      new Error('Invalid `prisma.otpChallenge.create()` invocation: identifier: "01712345678"')
    );

    return (
      logged.includes("prisma.otpChallenge.create()") &&
      !logged.includes("01712345678") &&
      /\n\s+at /.test(logged)
    );
  })()
);

console.log("\n=== Delivery-log redaction (simulated gateway failures) ===");

const FAKE_KEY = "C3x9QfakeKEYdoNotUse42";
const FAKE_PASSWORD = "smtp+pass/word=7";
const OTP = "482913";
const PHONE = "01712345678";
const leaks = (text: string) =>
  [
    FAKE_KEY,
    FAKE_PASSWORD,
    encodeURIComponent(FAKE_PASSWORD),
    OTP,
    PHONE,
    PHONE.slice(1),
    "sk_live_abcDEF1234567890ghiJKL",
    "ZmFrZTpzZWNyZXQ=",
    "abc123xyz",
    "s3cret",
    "shopper@example.com"
  ].filter((secret) => text.includes(secret));
const gatewayEchoes = [
  // The adapters' own wording, around what a proxy or captive portal can echo back.
  `BulkSMS BD returned something unreadable (HTTP 403): <p>Blocked request api_key=${FAKE_KEY}&type=text&number=880${PHONE.slice(1)}&senderid=STOREIM&message=Your+StoreIM+OTP+is+${OTP}.+Valid+for+5+minutes.</p>`,
  `Alpha SMS returned something that is not JSON (HTTP 502): GET https://api.sms.net.bd/sendsms?api_key=${FAKE_KEY}&msg=Your%20OTP%20is%20${OTP}&to=${PHONE}`,
  `Alpha SMS rejected the API key ({"api_key":"${FAKE_KEY}","msg":"Invalid number ${PHONE}"}).`,
  `upstream said Authorization: Bearer sk_live_abcDEF1234567890ghiJKL; proxy-authorization=Basic ZmFrZTpzZWNyZXQ=`,
  `key ${FAKE_KEY} was refused for +880 ${PHONE.slice(1, 5)}-${PHONE.slice(5)}`,
  `SMTP login failed at https://ops:s3cret@smtp.example.com/ for shopper@example.com with password=${encodeURIComponent(FAKE_PASSWORD)}`,
  `Invalid login: ${FAKE_PASSWORD} rejected`,
  // Shapes only one rule each can see: credentials on a host with no dot, and a
  // bearer token too short to look opaque, with no header name in front.
  "relay https://ops:s3cret@mailhost:2525/ refused; retried with Bearer abc123xyz"
];
const redactedEchoes = gatewayEchoes.map((text) => redactLogText(text, [FAKE_KEY, FAKE_PASSWORD]));
check(
  "no key, password, header, code, number or address survives a gateway echo",
  redactedEchoes.every((text) => leaks(text).length === 0),
  redactedEchoes
    .map((text, index) => `#${index}: ${leaks(text).join(",")}`)
    .filter((line) => !line.endsWith(": "))
    .join(" | ")
);
check(
  "without the server's own keys — a row from before a rotation — every labelled credential is still caught",
  [0, 1, 2, 3, 5, 7]
    .map((index) => redactLogText(gatewayEchoes[index] ?? ""))
    .every((text) => leaks(text).length === 0)
);
check(
  "an echoed SMS body is dropped whole, not just its digits",
  redactedEchoes[0]?.includes("&message=[redacted]") === true &&
    !/Valid\+for/.test(redactedEchoes[0] ?? "")
);
check(
  "what makes a failure worth reading is kept: the adapter's sentence, the HTTP status, the host",
  redactedEchoes[0]?.startsWith("BulkSMS BD returned something unreadable (HTTP 403):") === true &&
    redactedEchoes[1]?.includes("https://api.sms.net.bd/sendsms?[redacted]") === true &&
    redactedEchoes[2]?.includes('"msg":"Invalid number [number]"') === true &&
    redactLogText("BulkSMS BD error 1007 (Insufficient balance).") ===
      "BulkSMS BD error 1007 (Insufficient balance)." &&
    redactLogText("1007") === "1007"
);
check(
  "redaction is idempotent, so a stored row can be redacted again on display",
  redactedEchoes.every((text) => redactLogText(text, [FAKE_KEY]) === text) &&
    maskRecipient(maskRecipient(PHONE)) === maskRecipient(PHONE)
);
check(
  "an unlabelled key is struck out only because the server knows it is one",
  redactLogText(`key ${FAKE_KEY.slice(0, 12)} rejected`, [FAKE_KEY.slice(0, 12)]) ===
    "key [secret] rejected" &&
    redactLogText("token 9f8e7d6c5b4a39281706f5e4d3c2b1a0 expired") === "token [secret] expired"
);

const failed = toRedactedNotificationError(
  new NotificationError("AUTH", gatewayEchoes[2] ?? "", {
    cause: new Error(FAKE_KEY),
    providerCode: `405 ${FAKE_KEY}`
  }),
  [FAKE_KEY]
);
check(
  "the failure handed back to a caller keeps its kind and outage, loses the raw text and its cause",
  failed.kind === "AUTH" &&
    failed.isOutage &&
    leaks(failed.message).length === 0 &&
    failed.providerCode === "405 [secret]" &&
    failed.cause === undefined
);
check(
  "an error that is not the gateway's is wrapped and redacted the same way",
  (() => {
    const wrapped = toRedactedNotificationError(
      new TypeError(`fetch failed: https://x.test/a?api_key=${FAKE_KEY}`),
      []
    );

    return (
      wrapped.kind === "UNKNOWN" &&
      leaks(wrapped.message).length === 0 &&
      wrapped.cause === undefined
    );
  })()
);

const storedRow = redactDeliveryRow({
  channel: "SMS",
  errorCode: "1001",
  errorMessage: `${gatewayEchoes[0]} ${"x".repeat(600)}`,
  provider: "bulksmsbd",
  providerMessageId: "msg_1",
  recipient: PHONE,
  status: "FAILED",
  storeId: null,
  template: "otp_code"
});
check(
  "a stored row has a masked recipient, a redacted code and message capped at 500, and nothing else touched",
  storedRow.recipient === "********678" &&
    storedRow.errorCode === "1001" &&
    redactDeliveryRow({ errorCode: `to ${PHONE}`, errorMessage: null, recipient: PHONE })
      .errorCode === "to [number]" &&
    (storedRow.errorMessage?.length ?? 0) <= 500 &&
    leaks(`${storedRow.errorMessage}`).length === 0 &&
    storedRow.providerMessageId === "msg_1" &&
    storedRow.status === "FAILED"
);
check(
  "every row is written through redactDeliveryRow, and nowhere else writes the table",
  /await recordMessageDelivery\(redactDeliveryRow\(entry\)\);/.test(
    functionBody(source.notifications, "log")
  ) &&
    sourceFiles(MODULES)
      .filter((file) => /recordMessageDelivery\(|messageDelivery\.create\(/.test(read(file)))
      .map((file) => file.slice(MODULES.length + 1).replace(/\\/g, "/"))
      .sort()
      .join(",") ===
      "notifications/notifications.repository.ts,notifications/notifications.service.ts"
);
check(
  "a failed send is redacted with the send's own credentials before it is logged, stored or thrown",
  /const failure = toRedactedNotificationError\(error, input\.secrets\);/.test(
    functionBody(source.notifications, "deliver")
  ) &&
    /throw failure;/.test(functionBody(source.notifications, "deliver")) &&
    !/throw raw|throw error/.test(functionBody(source.notifications, "deliver")) &&
    source.notifications.includes("secrets: config.sms ? [config.sms.credentials.apiKey] : [],") &&
    source.notifications.includes("secrets: settings ? [settings.password] : [],")
);
check(
  "the admin console redacts again on display, with today's keys, and the account check too",
  /\.map\(\(failure\) => redactDeliveryRow\(failure, secretsOf\(config\)\)\)/.test(
    source.adminMessaging
  ) &&
    source.adminMessaging.includes("redactLogText(error.message, [sms.credentials.apiKey])") &&
    /return \[config\.sms\?\.credentials\.apiKey, config\.email\?\.password\];/.test(
      source.adminMessaging
    )
);

console.log("\n=== Production exposure ===");

function withEnv<T>(env: { NODE_ENV?: string; PLATFORM_ROOT_DOMAIN?: string }, work: () => T): T {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    PLATFORM_ROOT_DOMAIN: process.env.PLATFORM_ROOT_DOMAIN
  };
  const apply = (values: typeof saved) => {
    for (const key of ["NODE_ENV", "PLATFORM_ROOT_DOMAIN"] as const) {
      if (values[key] === undefined) delete process.env[key];
      else process.env[key] = values[key];
    }
  };

  apply({ NODE_ENV: env.NODE_ENV, PLATFORM_ROOT_DOMAIN: env.PLATFORM_ROOT_DOMAIN });

  try {
    return work();
  } finally {
    apply(saved);
  }
}

const STATUSES = ["BLOCKED", "FAILED", "SENT", "SKIPPED"] as const;
const exposes = () =>
  canEchoOtpCode() ||
  responseDevCode(OTP) !== undefined ||
  STATUSES.some((status) => otpDeliveryResult(status, OTP).devCode !== undefined);
check(
  "a production process never echoes a code — not for any delivery outcome, not at any response boundary",
  [undefined, "storeim.com", "localhost"].every(
    (domain) =>
      !withEnv(
        { NODE_ENV: "production", ...(domain ? { PLATFORM_ROOT_DOMAIN: domain } : {}) },
        exposes
      )
  )
);
check(
  'neither does a test run, an unset NODE_ENV, or anything that is not exactly "development"',
  [undefined, "", "test", "Development", "dev", "staging"].every(
    (mode) => !withEnv(mode === undefined ? {} : { NODE_ENV: mode }, exposes)
  )
);
check(
  "a development server configured with a real root domain — reachable by shoppers — never echoes either",
  ["storeim.com", "worzen.com", "app.storeim.com"].every(
    (domain) => !withEnv({ NODE_ENV: "development", PLATFORM_ROOT_DOMAIN: domain }, exposes)
  )
);
check(
  "local development still echoes, only for an unsent code, and only at the boundary that asked",
  [undefined, "localhost", "localhost:3000", "shop.localhost", "storeim.test"].every((domain) =>
    withEnv(
      { NODE_ENV: "development", ...(domain ? { PLATFORM_ROOT_DOMAIN: domain } : {}) },
      () =>
        canEchoOtpCode() &&
        responseDevCode(OTP) === OTP &&
        responseDevCode(undefined) === undefined &&
        otpDeliveryResult("SKIPPED", OTP).devCode === OTP &&
        otpDeliveryResult("SENT", OTP).devCode === undefined &&
        otpDeliveryResult("BLOCKED", OTP).devCode === undefined
    )
  )
);
check(
  "the gate reads process.env.NODE_ENV literally, so a production build compiles it to false",
  /export function canEchoOtpCode\(\) \{\s*return \(?\s*process\.env\.NODE_ENV === "development" && isLocalRootDomain\(process\.env\.PLATFORM_ROOT_DOMAIN\)\s*\)?;/.test(
    source.delivery
  ) && !/allowDevelopmentBuild/.test(source.nextConfig)
);
check(
  "the deployed unit runs a production build",
  /^Environment=NODE_ENV=production$/m.test(source.deployUnit) &&
    /^ExecStart=\S*next start\b/m.test(source.deployUnit) &&
    !/next dev/.test(source.deployUnit) &&
    /"start": "next start"/.test(source.webPackage)
);
check(
  "every code the OTP layer could echo is produced behind the gate",
  /status === "SKIPPED" && canEchoOtpCode\(\) \? \{ devCode: code \} : \{\}/.test(
    functionBody(source.delivery, "otpDeliveryResult")
  ) &&
    /if \(canEchoOtpCode\(\)\) \{[\s\S]*?return \{ delivered: false, devCode: input\.code \};/.test(
      functionBody(source.delivery, "deliverOtpCode")
    ) &&
    (code(source.delivery).match(/devCode: (?:input\.)?code\b/g) ?? []).length === 2 &&
    (code(source.delivery).match(/process\.env\.NODE_ENV/g) ?? []).length === 1
);
const otpAdjacent = [
  join(MODULES, "auth"),
  join(MODULES, "checkout"),
  join(MODULES, "loyalty"),
  join(MODULES, "notifications"),
  join(WEB, "app", "api")
].flatMap(sourceFiles);
check(
  "no other OTP, checkout, loyalty or notification code decides on NODE_ENV",
  otpAdjacent
    .filter((file) => /process\.env\.NODE_ENV/.test(read(file)))
    .map((file) => file.slice(WEB.length + 1).replace(/\\/g, "/"))
    .join(",") === "modules/auth/otp/otp-delivery.ts"
);
// Route handlers and server actions are the boundary: a component only renders
// what one of them already let through, and a service runs before them.
const ticketReaders = [...new Set([...otpAdjacent, ...sourceFiles(join(WEB, "app"))])].filter(
  (file) => /(route\.ts|\.actions\.ts)$/.test(file) && /ticket\.devCode/.test(read(file))
);
check(
  "every route and action that answers a code request re-checks the gate at the boundary",
  ticketReaders.length >= 5 &&
    ticketReaders.every((file) =>
      [...read(file).matchAll(/.{0,20}ticket\.devCode/g)].every((match) =>
        match[0].includes("responseDevCode(ticket.devCode")
      )
    ),
  ticketReaders.map((file) => file.slice(WEB.length + 1).replace(/\\/g, "/")).join(", ")
);

console.log("\n=== Store binding at every call site ===");

const otpCalls = sourceFiles(WEB).flatMap((file) =>
  ["requestOtpChallenge", "requestDeferredOtpChallenge", "verifyOtpChallenge"].flatMap((name) =>
    callsTo(read(file), name).map((call) => ({
      call,
      file: file.slice(WEB.length + 1).replace(/\\/g, "/"),
      purpose: /purpose: "([A-Z_]+)"/.exec(call)?.[1] ?? null
    }))
  )
);
const misbound = otpCalls.filter(
  ({ call, purpose }) =>
    purpose !== null && ["CHECKOUT", "LOYALTY"].includes(purpose) !== /\bstoreId\b/.test(call)
);
check(
  "every OTP call in the codebase names a store exactly when its purpose is a store's",
  otpCalls.filter((entry) => entry.purpose !== null).length >= 8 && misbound.length === 0,
  misbound.map((entry) => `${entry.file} ${entry.purpose}`).join(", ")
);

console.log("\n=== Rate-limit boundaries (simulated) ===");

type Send = { identifier: string; ipAddress: string | null; storeId: string | null };
const inScope = (send: Send, scope: OtpSendScope) =>
  (scope.identifier === undefined || send.identifier === scope.identifier) &&
  (scope.ipAddress === undefined || send.ipAddress === scope.ipAddress) &&
  (scope.storeId === undefined || send.storeId === scope.storeId);
async function request(sends: Send[], next: Send) {
  const ceiling = await firstExceededOtpCeiling(
    otpSendCeilings(next),
    (scope) => sends.filter((send) => inScope(send, scope)).length
  );

  if (!ceiling) {
    sends.push(next);
  }

  return ceiling;
}
async function fill(sends: Send[], next: Send, tries = 12) {
  for (let accepted = 0; accepted < tries; accepted += 1) {
    const ceiling = await request(sends, next);

    if (ceiling) {
      return { accepted, ceiling };
    }
  }

  return { accepted: tries, ceiling: null };
}

const shopSends: Send[] = [];
const atShopA = await fill(shopSends, { identifier: PHONE, ipAddress: null, storeId: "shop_a" });
const atShopB = await fill(shopSends, { identifier: PHONE, ipAddress: null, storeId: "shop_b" });
const atShopC = await fill(shopSends, { identifier: PHONE, ipAddress: null, storeId: "shop_c" });
check(
  "shop A stops at its own 5; shop B still gets its own 5; a third shop meets the global 10",
  atShopA.accepted === 5 &&
    atShopA.ceiling?.scope.storeId === "shop_a" &&
    atShopB.accepted === 5 &&
    atShopB.ceiling?.scope.storeId === "shop_b" &&
    atShopC.accepted === 0 &&
    atShopC.ceiling?.limit === 10 &&
    atShopC.ceiling.scope.storeId === undefined,
  `A ${atShopA.accepted}, B ${atShopB.accepted}, C ${atShopC.accepted} (${JSON.stringify(atShopC.ceiling)})`
);
check(
  "sign-up is unchanged: four shop codes leave it one, five use up its hour",
  await (async () => {
    const four: Send[] = Array.from({ length: 4 }, () => ({
      identifier: PHONE,
      ipAddress: null,
      storeId: "shop_a"
    }));
    const five: Send[] = [...four, { identifier: PHONE, ipAddress: null, storeId: "shop_b" }];
    const signUp = { identifier: PHONE, ipAddress: null, storeId: null };

    return (await request(four, signUp)) === null && (await request(five, signUp))?.limit === 5;
  })()
);
check(
  "one network gets 20 codes an hour across numbers and shops; the 21st is refused as a network",
  await (async () => {
    const sends: Send[] = [];
    let accepted = 0;

    for (let i = 0; i < 25; i += 1) {
      const ceiling = await request(sends, {
        identifier: `0171${String(i).padStart(7, "0")}`,
        ipAddress: "203.0.113.9",
        storeId: i % 2 === 0 ? "shop_a" : null
      });

      if (ceiling) {
        return accepted === 20 && ceiling.scope.ipAddress === "203.0.113.9" && ceiling.limit === 20;
      }

      accepted += 1;
    }

    return false;
  })()
);
check(
  "ceilings are checked in order and no further than needed",
  await (async () => {
    const asked: string[] = [];
    const full: Send[] = Array.from({ length: 5 }, () => ({
      identifier: PHONE,
      ipAddress: "203.0.113.9",
      storeId: "shop_a"
    }));
    await firstExceededOtpCeiling(
      otpSendCeilings({ identifier: PHONE, ipAddress: "203.0.113.9", storeId: "shop_a" }),
      (scope) => {
        asked.push(Object.keys(scope).sort().join("+"));
        return full.filter((send) => inScope(send, scope)).length;
      }
    );

    return JSON.stringify(asked) === '["identifier+storeId"]';
  })()
);
check(
  "brute force stays bounded: 5 guesses a challenge, 5 sends an hour per handle or per shop and number",
  /const maxAttemptsPerChallenge = 5;/.test(source.service) &&
    (otpSendCeilings({ identifier: PHONE, ipAddress: null, storeId: null })[0]?.limit ?? 0) === 5 &&
    (otpSendCeilings({ identifier: PHONE, ipAddress: null, storeId: "shop_a" })[0]?.limit ?? 0) ===
      5
);
check(
  "the simulation counts exactly what the repository counts",
  /scope\.identifier === undefined \? \{\} : \{ identifier: scope\.identifier \}/.test(
    functionBody(source.repository, "scopeWhere")
  ) &&
    /scope\.ipAddress === undefined \? \{\} : \{ ipAddress: scope\.ipAddress \}/.test(
      functionBody(source.repository, "scopeWhere")
    ) &&
    /firstExceededOtpCeiling\(otpSendCeilings\(input\), \(scope\) =>\s*countOtpSendsSince\(scope, since\)\s*\)/.test(
      functionBody(source.service, "assertSendAllowance")
    )
);

console.log("\n=== Console output ===");

const SAFE_INTERPOLATIONS = new Set([
  "blocked.limit",
  "blocked.used",
  "credentials.senderId",
  "failure.kind",
  "input.channel.toLowerCase()",
  "input.template",
  "storeId"
]);
const REDACTED = /^(maskRecipient|redactLogText|previewForLog|errorForLog)\(/;
const logged = [
  join(MODULES, "admin", "admin-messaging.actions.ts"),
  join(MODULES, "admin", "admin-messaging.service.ts"),
  join(MODULES, "auth"),
  join(MODULES, "notifications"),
  join(MODULES, "loyalty"),
  join(MODULES, "checkout", "checkout-verification.service.ts"),
  join(WEB, "app", "api", "auth"),
  join(WEB, "app", "api", "checkout")
].flatMap((path) => (statSync(path).isDirectory() ? sourceFiles(path) : [path]));
const consoleCalls = logged.flatMap((file) =>
  [...read(file).matchAll(/console\.\w+\(([\s\S]*?)\);/g)].map((match) => ({
    args: match[1] ?? "",
    file: file.slice(WEB.length + 1).replace(/\\/g, "/")
  }))
);
const unsafe = consoleCalls.filter(({ args }) => {
  const interpolations = [...args.matchAll(/\$\{([^}]*)\}/g)].map((match) =>
    (match[1] ?? "").trim()
  );
  const extraArgument = /^\s*(["'`])[\s\S]*?\1\s*,/.test(args);

  return (
    extraArgument ||
    interpolations.some(
      (expression) => !SAFE_INTERPOLATIONS.has(expression) && !REDACTED.test(expression)
    )
  );
});
check(
  "every console call in auth, notifications, checkout and loyalty logs only safe or redacted values",
  consoleCalls.length >= 10 && unsafe.length === 0,
  unsafe.map((call) => `${call.file}: ${call.args.replace(/\s+/g, " ").slice(0, 90)}`).join(" | ")
);
check(
  "the unconfigured-install line masks the recipient and withholds a code",
  source.notifications.includes(
    "${input.template} to ${maskRecipient(input.recipient)}: ${previewForLog(input.template, input.preview)}"
  ) && !/\$\{input\.(recipient|preview)\}/.test(source.notifications)
);

console.log(
  failures === 0
    ? "\nOTP: all checks passed."
    : `\nOTP: ${failures} check${failures === 1 ? "" : "s"} failed.`
);

process.exit(failures === 0 ? 0 : 1);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true })
    .map(String)
    .filter((name) => /\.tsx?$/.test(name) && !name.includes("generated"))
    .map((name) => join(directory, name));
}
