import type { Prisma } from "@dash/db";
import type { AccountIdentifier } from "../identifier";
import { generateOtpCode, hashOtpCode, matchesOtpCode } from "./otp-code";
import { errorForLog } from "../../notifications/notifications.redact";
import { canEchoOtpCode, deliverOtpCode, type OtpDeliveryResult } from "./otp-delivery";
import { OtpError } from "./otp-errors";
import {
  consumeOtpChallenge,
  countOtpSendsSince,
  createOtpChallenge,
  findLatestOpenOtpChallenge,
  findOldestOtpSendSince,
  recordOtpChallengeAttempt,
  recordOtpChallengeResend,
  sweepOtpChallengesBefore,
  type OtpSendScope
} from "./otp.repository";
import type { OtpChannel, OtpPurpose } from "./otp.schema";

/**
 * Every rule about how hard a code is to abuse lives in this file.
 *
 * There are two independent budgets and they answer different threats. The
 * per-challenge ones (attempts, resends, cooldown) stop someone guessing at one
 * account. The hourly ones stop someone spending our SMS balance — which is
 * real money with Alpha SMS, and the failure mode is that registration stops
 * working for everybody at once.
 *
 * A code a store pays for — a cash-on-delivery confirmation, a loyalty code —
 * belongs to that store. Its challenge carries the store's id, every lookup is
 * narrowed by it, and its hourly ceiling is the store's own, so one shop can
 * neither spend nor shadow another shop's code, cooldown or attempts. Above the
 * stores sits one global ceiling per number, which is the only place one
 * shop's traffic still reaches another's. Account codes (sign-up, reset,
 * contact change) are the platform's and are keyed by handle alone, as before.
 *
 * Together they bound a brute-force run at five challenges an hour times five
 * guesses, against a one-in-a-million code — per handle for an account code,
 * per store and number for a store's code.
 */

/** SMS is short-lived because it arrives in seconds; email can sit in a queue. */
const codeTtlMs: Record<OtpChannel, number> = {
  EMAIL: 10 * 60_000,
  SMS: 5 * 60_000
};

/** The purposes a store pays for, and so the purposes whose codes belong to it. */
const STORE_PURPOSES: ReadonlySet<OtpPurpose> = new Set<OtpPurpose>(["CHECKOUT", "LOYALTY"]);

const resendCooldownMs = 60_000;
const maxResendsPerChallenge = 3;
const maxAttemptsPerChallenge = 5;
const sendWindowMs = 60 * 60_000;
/** Account codes: every code sent to the handle counts, a store's included. */
const maxSendsPerIdentifier = 5;
/** One store's own codes to one number. */
const maxStoreSendsPerIdentifier = 5;
/**
 * The global abuse-control ceiling on a store's codes. Every code sent to the
 * number counts — from every store and from sign-up — so a number cannot be
 * messaged by shop after shop, and no store can be the reason another store's
 * shopper is refused until the number has had this many codes in the hour.
 */
const maxSendsPerIdentifierAcrossStores = 10;
const maxSendsPerIp = 20;

/** Comfortably longer than the counting window, so a sweep never frees a slot. */
const retentionMs = 24 * 60 * 60_000;

export type OtpChallengeTicket = {
  attemptsRemaining: number;
  channel: OtpChannel;
  /** Development only — see `otp-delivery` and `requestDeferredOtpChallenge`. */
  devCode?: string;
  expiresAt: Date;
  identifier: string;
  resendAvailableAt: Date;
};

export type VerifiedOtpChallenge = {
  channel: OtpChannel;
  identifier: string;
  payload: Prisma.JsonValue | null;
};

type OtpChallengeRequest = {
  identifier: AccountIdentifier;
  ipAddress: string | null;
  payload?: Prisma.InputJsonValue;
  purpose: OtpPurpose;
  /**
   * The store whose plan allowance pays for the message, when one does — and
   * so the store the challenge belongs to. Required for exactly the store
   * purposes; see `otpChallengeStore`.
   */
  storeId?: string | null;
};

export async function requestOtpChallenge(
  input: OtpChallengeRequest & {
    /**
     * Goes through every motion except handing the code to a gateway.
     *
     * Password reset needs this: it has to answer identically whether or not an
     * account exists, and skipping the work for an unknown handle would leave a
     * timing difference that says "nobody here" just as clearly as an error would.
     */
    suppressDelivery?: boolean;
  }
): Promise<OtpChallengeTicket> {
  const opened = await openOtpChallenge(input);
  const delivery: OtpDeliveryResult = input.suppressDelivery
    ? { delivered: false }
    : await opened.deliver();

  return {
    ...opened.ticket,
    ...(delivery.devCode === undefined ? {} : { devCode: delivery.devCode })
  };
}

/**
 * The challenge now and the message later, for a caller that has to answer
 * before the gateway does: the loyalty code is sent only to members, so a reply
 * that waited for the gateway would say who is one.
 *
 * `deliver` is handed to the caller to run after its response, through the
 * framework's own `after()`, never as a promise left floating. It never throws:
 * a refused send is already in the delivery log and the server log, and there
 * is nobody left to tell. Because the reply cannot know how the send went, a
 * development build echoes the code on every ticket, whether or not it is ever
 * delivered — so a development reply says nothing about delivery either, and
 * production never echoes it.
 */
export async function requestDeferredOtpChallenge(input: OtpChallengeRequest) {
  const opened = await openOtpChallenge(input);

  return {
    deliver: async () => {
      try {
        await opened.deliver();
      } catch (error) {
        // Nobody is waiting on this reply any more, so the server log is the
        // only place a failure can go. A gateway refusal is there already and
        // in the delivery log; this line also covers what fails before the
        // gateway is reached — the allowance read, say — which nothing else
        // would record.
        console.warn(
          `[otp] a code sent after the reply did not go out: ${errorForLog(error instanceof Error && error.cause !== undefined ? error.cause : error)}`
        );
      }
    },
    ticket: {
      ...opened.ticket,
      ...(canEchoOtpCode() ? { devCode: opened.code } : {})
    } satisfies OtpChallengeTicket
  };
}

async function openOtpChallenge(input: OtpChallengeRequest) {
  const { channel, value } = describeIdentifier(input.identifier);
  const storeId = otpChallengeStore(input.purpose, input.storeId);
  const now = new Date();
  const open = await findLatestOpenOtpChallenge(value, input.purpose, storeId);
  const reusable =
    open && open.expiresAt > now && open.attempts < maxAttemptsPerChallenge ? open : null;

  // A challenge that has expired or run out of guesses gets closed rather than
  // revived. Reviving it would refund a brute-force budget that is meant to
  // stay spent, and leaving it open would shadow the code we are about to send.
  if (open && !reusable) {
    await consumeOtpChallenge(open.id, now);
  }

  if (reusable) {
    const waitMs = resendCooldownMs - (now.getTime() - reusable.lastSentAt.getTime());

    if (waitMs > 0) {
      throw new OtpError("COOLDOWN", "A code was just sent. Wait a moment before asking for another.", {
        retryAfterSeconds: Math.ceil(waitMs / 1000)
      });
    }

    if (reusable.resendCount >= maxResendsPerChallenge) {
      throw new OtpError(
        "RESEND_LIMIT",
        "That code has been resent as many times as we allow. Start again in a little while."
      );
    }
  }

  await assertSendAllowance({ identifier: value, ipAddress: input.ipAddress, now, storeId });

  const code = generateOtpCode();
  const codeHash = hashOtpCode(value, code);
  const expiresAt = new Date(now.getTime() + codeTtlMs[channel]);

  if (reusable) {
    await recordOtpChallengeResend(reusable.id, { codeHash, expiresAt, sentAt: now });
  } else {
    await sweepOtpChallengesBefore(new Date(now.getTime() - retentionMs));
    await createOtpChallenge({
      channel,
      codeHash,
      expiresAt,
      identifier: value,
      ipAddress: input.ipAddress,
      payload: challengePayload(input.payload, storeId),
      purpose: input.purpose,
      sentAt: now
    });
  }

  return {
    code,
    deliver: () =>
      deliverOtpCode({
        channel,
        code,
        expiresInMinutes: Math.round(codeTtlMs[channel] / 60_000),
        identifier: value,
        storeId
      }),
    ticket: {
      attemptsRemaining: maxAttemptsPerChallenge - (reusable?.attempts ?? 0),
      channel,
      expiresAt,
      identifier: value,
      resendAvailableAt: new Date(now.getTime() + resendCooldownMs)
    }
  };
}

export async function verifyOtpChallenge(input: {
  code: string;
  identifier: AccountIdentifier;
  purpose: OtpPurpose;
  /** The store the code was requested at — required for exactly the store purposes. */
  storeId?: string | null;
}): Promise<VerifiedOtpChallenge> {
  const { channel, value } = describeIdentifier(input.identifier);
  const now = new Date();
  // Narrowed by store before anything is counted, so a code tried at the wrong
  // shop finds nothing there and costs the right shop's challenge no attempt.
  const challenge = await findLatestOpenOtpChallenge(
    value,
    input.purpose,
    otpChallengeStore(input.purpose, input.storeId)
  );

  if (!challenge) {
    throw new OtpError(
      "CHALLENGE_NOT_FOUND",
      "There is no code waiting to be confirmed for this address or number. Ask for a new one."
    );
  }

  if (challenge.expiresAt <= now) {
    await consumeOtpChallenge(challenge.id, now);

    throw new OtpError("EXPIRED", "That code has expired. Ask for a new one.");
  }

  if (challenge.attempts >= maxAttemptsPerChallenge) {
    await consumeOtpChallenge(challenge.id, now);

    throw new OtpError("TOO_MANY_ATTEMPTS", "Too many wrong codes. Ask for a new one.");
  }

  if (!matchesOtpCode(value, input.code, challenge.codeHash)) {
    const attempted = await recordOtpChallengeAttempt(challenge.id);
    const attemptsRemaining = Math.max(0, maxAttemptsPerChallenge - attempted.attempts);

    if (attemptsRemaining === 0) {
      await consumeOtpChallenge(challenge.id, now);

      throw new OtpError("TOO_MANY_ATTEMPTS", "Too many wrong codes. Ask for a new one.");
    }

    throw new OtpError("INVALID_CODE", "That code is not right.", { attemptsRemaining });
  }

  await consumeOtpChallenge(challenge.id, now);

  return {
    channel,
    identifier: value,
    payload: challenge.payload
  };
}

/**
 * The store a challenge belongs to: exactly the store purposes, and only with
 * their store named. Getting this wrong either way is a programming error, not
 * a visitor's — a store's code looked up by number alone could be spent at
 * another shop, and an account code tied to a store could never be found.
 */
export function otpChallengeStore(purpose: OtpPurpose, storeId: string | null | undefined) {
  const store = storeId ?? null;

  if (STORE_PURPOSES.has(purpose) !== (store !== null)) {
    throw new Error(
      `An OTP ${purpose} challenge ${store === null ? "must" : "cannot"} name a store.`
    );
  }

  return store;
}

/** A store's challenge carries its store and nothing else; an account challenge, what its flow gave. */
function challengePayload(payload: Prisma.InputJsonValue | undefined, storeId: string | null) {
  if (storeId === null) {
    return payload ?? null;
  }

  if (payload !== undefined) {
    throw new Error("A store's OTP challenge carries only its store.");
  }

  return { storeId };
}

export type OtpSendCeiling = {
  limit: number;
  scope: OtpSendScope;
};

/**
 * The hourly ceilings one more send must stay under, in the order they are
 * checked. An account code answers to its handle; a store's code to that
 * store's own count, then the global count across every store and sign-up.
 * The network ceiling applies to both.
 */
export function otpSendCeilings(input: {
  identifier: string;
  ipAddress: string | null;
  storeId: string | null;
}): OtpSendCeiling[] {
  return [
    ...(input.storeId === null
      ? []
      : [
          {
            limit: maxStoreSendsPerIdentifier,
            scope: { identifier: input.identifier, storeId: input.storeId }
          }
        ]),
    {
      limit: input.storeId === null ? maxSendsPerIdentifier : maxSendsPerIdentifierAcrossStores,
      scope: { identifier: input.identifier }
    },
    // No address means we are behind something that strips the header. That is
    // a reason to fall back to the per-number ceilings, not to refuse the send.
    ...(input.ipAddress ? [{ limit: maxSendsPerIp, scope: { ipAddress: input.ipAddress } }] : [])
  ];
}

async function assertSendAllowance(input: {
  identifier: string;
  ipAddress: string | null;
  now: Date;
  storeId: string | null;
}) {
  const since = new Date(input.now.getTime() - sendWindowMs);
  const ceiling = await firstExceededOtpCeiling(otpSendCeilings(input), (scope) =>
    countOtpSendsSince(scope, since)
  );

  if (ceiling) {
    throw new OtpError(
      "TOO_MANY_REQUESTS",
      ceiling.scope.ipAddress === undefined
        ? "Too many codes have gone to this address or number in the last hour. Try again later."
        : "Too many verification codes have been requested from this network. Try again later.",
      await retryAfter(ceiling.scope, since, input.now)
    );
  }
}

/**
 * The first ceiling one more send would break, checked in order and no further
 * than needed. The counter is handed in, so the same decision can be driven
 * from the database here and from a list of sends in `verify-otp`.
 */
export async function firstExceededOtpCeiling(
  ceilings: OtpSendCeiling[],
  count: (scope: OtpSendScope) => number | Promise<number>
) {
  for (const ceiling of ceilings) {
    if ((await count(ceiling.scope)) >= ceiling.limit) {
      return ceiling;
    }
  }

  return null;
}

async function retryAfter(scope: OtpSendScope, since: Date, now: Date) {
  const oldest = await findOldestOtpSendSince(scope, since);

  if (!oldest) {
    return {};
  }

  const freesAtMs = oldest.createdAt.getTime() + sendWindowMs - now.getTime();

  return { retryAfterSeconds: Math.max(1, Math.ceil(freesAtMs / 1000)) };
}

function describeIdentifier(identifier: AccountIdentifier): { channel: OtpChannel; value: string } {
  return identifier.channel === "EMAIL"
    ? { channel: "EMAIL", value: identifier.email }
    : { channel: "SMS", value: identifier.phone };
}
