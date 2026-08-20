import type { Prisma } from "@dash/db";
import type { AccountIdentifier } from "../identifier";
import { generateOtpCode, hashOtpCode, matchesOtpCode } from "./otp-code";
import { deliverOtpCode } from "./otp-delivery";
import { OtpError } from "./otp-errors";
import {
  consumeOtpChallenge,
  countOtpSendsSince,
  createOtpChallenge,
  findLatestOpenOtpChallenge,
  findOldestOtpSendSince,
  recordOtpChallengeAttempt,
  recordOtpChallengeResend,
  sweepOtpChallengesBefore
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
 * Together they bound a brute-force run at five challenges an hour times five
 * guesses, against a one-in-a-million code.
 */

/** SMS is short-lived because it arrives in seconds; email can sit in a queue. */
const codeTtlMs: Record<OtpChannel, number> = {
  EMAIL: 10 * 60_000,
  SMS: 5 * 60_000
};

const resendCooldownMs = 60_000;
const maxResendsPerChallenge = 3;
const maxAttemptsPerChallenge = 5;
const sendWindowMs = 60 * 60_000;
const maxSendsPerIdentifier = 5;
const maxSendsPerIp = 20;

/** Comfortably longer than the counting window, so a sweep never frees a slot. */
const retentionMs = 24 * 60 * 60_000;

export type OtpChallengeTicket = {
  attemptsRemaining: number;
  channel: OtpChannel;
  /** Development only — see `otp-delivery`. */
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

export async function requestOtpChallenge(input: {
  identifier: AccountIdentifier;
  ipAddress: string | null;
  payload?: Prisma.InputJsonValue;
  purpose: OtpPurpose;
  /** The store whose plan allowance pays for the message, when one does. */
  storeId?: string | null;
  /**
   * Goes through every motion except handing the code to a gateway.
   *
   * Password reset needs this: it has to answer identically whether or not an
   * account exists, and skipping the work for an unknown handle would leave a
   * timing difference that says "nobody here" just as clearly as an error would.
   */
  suppressDelivery?: boolean;
}): Promise<OtpChallengeTicket> {
  const { channel, value } = describeIdentifier(input.identifier);
  const now = new Date();
  const open = await findLatestOpenOtpChallenge(value, input.purpose);
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

  await assertSendAllowance({ identifier: value, ipAddress: input.ipAddress, now });

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
      payload: input.payload ?? null,
      purpose: input.purpose,
      sentAt: now
    });
  }

  const delivery = input.suppressDelivery
    ? { delivered: false }
    : await deliverOtpCode({
        channel,
        code,
        expiresInMinutes: Math.round(codeTtlMs[channel] / 60_000),
        identifier: value,
        storeId: input.storeId ?? null
      });

  return {
    attemptsRemaining: maxAttemptsPerChallenge - (reusable?.attempts ?? 0),
    channel,
    ...(delivery.devCode === undefined ? {} : { devCode: delivery.devCode }),
    expiresAt,
    identifier: value,
    resendAvailableAt: new Date(now.getTime() + resendCooldownMs)
  };
}

export async function verifyOtpChallenge(input: {
  code: string;
  identifier: AccountIdentifier;
  purpose: OtpPurpose;
}): Promise<VerifiedOtpChallenge> {
  const { channel, value } = describeIdentifier(input.identifier);
  const now = new Date();
  const challenge = await findLatestOpenOtpChallenge(value, input.purpose);

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

async function assertSendAllowance(input: {
  identifier: string;
  ipAddress: string | null;
  now: Date;
}) {
  const since = new Date(input.now.getTime() - sendWindowMs);
  const toIdentifier = await countOtpSendsSince({ identifier: input.identifier }, since);

  if (toIdentifier >= maxSendsPerIdentifier) {
    throw new OtpError(
      "TOO_MANY_REQUESTS",
      "Too many codes have gone to this address or number in the last hour. Try again later.",
      await retryAfter({ identifier: input.identifier }, since, input.now)
    );
  }

  // No address means we are behind something that strips the header. That is a
  // reason to fall back to the per-identifier ceiling, not to refuse the send.
  if (!input.ipAddress) {
    return;
  }

  const fromIp = await countOtpSendsSince({ ipAddress: input.ipAddress }, since);

  if (fromIp >= maxSendsPerIp) {
    throw new OtpError(
      "TOO_MANY_REQUESTS",
      "Too many verification codes have been requested from this network. Try again later.",
      await retryAfter({ ipAddress: input.ipAddress }, since, input.now)
    );
  }
}

async function retryAfter(
  scope: { identifier?: string; ipAddress?: string },
  since: Date,
  now: Date
) {
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
