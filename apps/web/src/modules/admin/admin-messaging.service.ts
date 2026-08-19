import { describeEmailTransport } from "../notifications/email-transport";
import {
  countMessageDeliveriesSince,
  listRecentMessageFailures
} from "../notifications/notifications.repository";
import type { SmsProvider } from "../notifications/sms/provider.types";
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
    FAILED: number;
    SENT: number;
    SKIPPED: number;
  };
};

export async function getMessagingHealth(): Promise<MessagingHealth> {
  const since = new Date(Date.now() - windowMs);
  const email = describeEmailTransport();
  const [totals, failures, sms] = await Promise.all([
    countMessageDeliveriesSince(since),
    listRecentMessageFailures(failuresShown),
    describeSmsHealth(getSmsProvider())
  ]);

  return {
    email: {
      configured: email !== null,
      host: email?.host ?? null
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

async function describeSmsHealth(provider: SmsProvider): Promise<MessagingHealth["sms"]> {
  const base = {
    balance: null,
    isLow: false,
    label: provider.label,
    statusError: null,
    validUntil: null
  };

  if (!provider.isConfigured() || !provider.readAccountStatus) {
    return { ...base, configured: provider.isConfigured() };
  }

  try {
    const status = await provider.readAccountStatus();

    return {
      ...base,
      balance: status.balance,
      configured: true,
      isLow: status.balance !== null && status.balance < lowBalanceThreshold,
      validUntil: status.validUntil
    };
  } catch (error) {
    // An account we cannot read is itself worth showing — it usually means the
    // API key stopped working, which is the same outage by another route.
    return {
      ...base,
      configured: true,
      statusError: error instanceof Error ? error.message : "Could not read the account."
    };
  }
}
