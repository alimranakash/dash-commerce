import type { SmsCredentials, SmsProviderKey } from "../notifications.config";

export type SmsAccountStatus = {
  /** In the gateway's own currency — BDT for the Bangladeshi gateways. */
  balance: number | null;
  /** Some gateways expire an account independently of its credit. */
  validUntil: Date | null;
};

/**
 * The single file a new SMS gateway has to satisfy.
 *
 * Deliberately narrow: the service only ever needs to know whether a provider
 * can be used, how to hand it one message, and — where the gateway offers it —
 * what credit is left. Everything else about a gateway's API stays behind its
 * own adapter, the same arrangement the courier providers use.
 */
export type SmsProvider = {
  key: SmsProviderKey;
  label: string;
  /**
   * Whatever the gateway will say about the account itself, when it says
   * anything. Optional because not every gateway exposes it, and because a
   * balance nobody can read is not a reason to refuse to send.
   */
  readAccountStatus?: (credentials: SmsCredentials) => Promise<SmsAccountStatus>;
  /**
   * Credentials are handed in rather than looked up, so an adapter is a pure
   * translation of one gateway's API and the question of where a key came from
   * — the admin panel or the environment — is settled in exactly one place.
   */
  send(
    input: { message: string; to: string },
    credentials: SmsCredentials
  ): Promise<{ providerMessageId: string | null }>;
};
