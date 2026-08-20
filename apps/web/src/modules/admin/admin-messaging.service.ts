import {
  countMessageDeliveriesSince,
  listRecentMessageFailures
} from "../notifications/notifications.repository";
import { resolveMessagingConfig } from "../notifications/notifications.config";
import { getSmsProvider } from "../notifications/sms/registry";

/**
 * What the admin overview needs to answer "is anything getting through".
 *
 * Registration now depends on an outside gateway with a balance that runs out,
 * and the failure is total when it does — so the number has to be visible
 * before it reaches zero rather than discovered from a support ticket.
 */

/** Roughly a few hundred messages at Bangladeshi per-SMS rates. */
const lowBalanceThreshold = 100;

const failuresShown = 5;
const windowMs = 24 * 60 * 60_000;

export type MessagingHealth = {
  email: {
    configured: boolean;
    host: string | null;
  };
  recentFailures: Array<{
    channel: string;
    errorCode: string | null;
    errorMessage: string | null;
    id: string;
    recipient: string;
    sentAt: Date;
  }>;
  sms: {
    balance: number | null;
    configured: boolean;
    isLow: boolean;
    label: string;
    /** Set when the account itself could not be read — usually a dead API key. */
    statusError: string | null;
    validUntil: Date | null;
  };
  totals: {
    BLOCKED: number;
    FAILED: number;
    SENT: number;
    SKIPPED: number;
  };
};

export async function getMessagingHealth(): Promise<MessagingHealth> {
  const since = new Date(Date.now() - windowMs);
  const config = await resolveMessagingConfig();
  const [totals, failures, sms] = await Promise.all([
    countMessageDeliveriesSince(since),
    listRecentMessageFailures(failuresShown),
    describeSmsHealth(config.sms)
  ]);

  return {
    email: {
      configured: config.email !== null,
      host: config.email?.host ?? null
    },
    recentFailures: failures.map((failure) => ({
      channel: failure.channel,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
      id: failure.id,
      recipient: failure.recipient,
      sentAt: failure.createdAt
    })),
    sms,
    totals
  };
}

async function describeSmsHealth(
  sms: Awaited<ReturnType<typeof resolveMessagingConfig>>["sms"]
): Promise<MessagingHealth["sms"]> {
  if (!sms) {
    return {
      balance: null,
      configured: false,
      isLow: false,
      label: "SMS",
      statusError: null,
      validUntil: null
    };
  }

  const provider = getSmsProvider(sms.provider);
  const base = {
    balance: null,
    configured: true,
    isLow: false,
    label: provider.label,
    statusError: null,
    validUntil: null
  };

  if (!provider.readAccountStatus) {
    return base;
  }

  try {
    const status = await provider.readAccountStatus(sms.credentials);

    return {
      ...base,
      balance: status.balance,
      isLow: status.balance !== null && status.balance < lowBalanceThreshold,
      validUntil: status.validUntil
    };
  } catch (error) {
    // An account we cannot read is itself worth showing — it usually means the
    // API key stopped working, which is the same outage by another route.
    return {
      ...base,
      statusError: error instanceof Error ? error.message : "Could not read the account."
    };
  }
}
