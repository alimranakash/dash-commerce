import { prisma } from "@dash/db";
import type { Prisma } from "@dash/db";
import type { OtpChannel, OtpPurpose } from "./otp.schema";

/**
 * The only place that touches `otpChallenge`. Nothing here decides policy — the
 * cooldowns, ceilings and expiry live in the service, so there is a single file
 * to read when asking "how hard is this to abuse".
 */

/**
 * The challenge a code would be checked against: the newest one still open for
 * this handle. Expired rows are returned too, deliberately — the service can
 * then say "that code has expired" instead of the far more confusing "no code
 * was requested".
 */
export async function findLatestOpenOtpChallenge(identifier: string, purpose: OtpPurpose) {
  return prisma.otpChallenge.findFirst({
    orderBy: {
      createdAt: "desc"
    },
    where: {
      consumedAt: null,
      identifier,
      purpose
    }
  });
}

export async function createOtpChallenge(data: {
  channel: OtpChannel;
  codeHash: string;
  expiresAt: Date;
  identifier: string;
  ipAddress: string | null;
  payload: Prisma.InputJsonValue | null;
  purpose: OtpPurpose;
  sentAt: Date;
}) {
  return prisma.otpChallenge.create({
    data: {
      channel: data.channel,
      codeHash: data.codeHash,
      expiresAt: data.expiresAt,
      identifier: data.identifier,
      ipAddress: data.ipAddress,
      lastSentAt: data.sentAt,
      purpose: data.purpose,
      // A nullable Json column will not take a bare `null` through Prisma, and
      // an absent payload is exactly the same thing as an unset column here.
      ...(data.payload === null ? {} : { payload: data.payload })
    }
  });
}

/** A resend replaces the code rather than issuing a second valid one. */
export async function recordOtpChallengeResend(
  id: string,
  data: { codeHash: string; expiresAt: Date; sentAt: Date }
) {
  return prisma.otpChallenge.update({
    data: {
      codeHash: data.codeHash,
      expiresAt: data.expiresAt,
      lastSentAt: data.sentAt,
      resendCount: {
        increment: 1
      }
    },
    where: {
      id
    }
  });
}

export async function recordOtpChallengeAttempt(id: string) {
  return prisma.otpChallenge.update({
    data: {
      attempts: {
        increment: 1
      }
    },
    where: {
      id
    }
  });
}

export async function consumeOtpChallenge(id: string, consumedAt: Date) {
  return prisma.otpChallenge.update({
    data: {
      consumedAt
    },
    where: {
      id
    }
  });
}

/**
 * Codes *sent*, not challenges created.
 *
 * A resend puts another message on the wire and costs another SMS, so counting
 * rows would let someone stay under the ceiling forever by resending into one
 * challenge. `_count` plus the resends on those rows is the real total.
 */
export async function countOtpSendsSince(
  scope: { identifier?: string; ipAddress?: string },
  since: Date
) {
  const totals = await prisma.otpChallenge.aggregate({
    _count: {
      _all: true
    },
    _sum: {
      resendCount: true
    },
    where: {
      createdAt: {
        gte: since
      },
      ...scope
    }
  });

  return totals._count._all + (totals._sum.resendCount ?? 0);
}

/**
 * When the oldest send inside the window falls out of it, a slot frees up. That
 * is the honest answer to "how long until I can try again" — far better than
 * quoting the whole window to someone who has waited most of it already.
 */
export async function findOldestOtpSendSince(
  scope: { identifier?: string; ipAddress?: string },
  since: Date
) {
  return prisma.otpChallenge.findFirst({
    orderBy: {
      createdAt: "asc"
    },
    select: {
      createdAt: true
    },
    where: {
      createdAt: {
        gte: since
      },
      ...scope
    }
  });
}

/**
 * Consumed and expired rows are kept well past their code because they are what
 * the hourly ceiling counts — dropping them on use would hand an abuser a fresh
 * allowance every time they completed a challenge.
 */
export async function sweepOtpChallengesBefore(cutoff: Date) {
  const removed = await prisma.otpChallenge.deleteMany({
    where: {
      createdAt: {
        lt: cutoff
      }
    }
  });

  return removed.count;
}
