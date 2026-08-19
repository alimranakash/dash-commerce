import { readSmsProviderKey, type SmsProviderKey } from "../notifications.config";
import { alphaSmsProvider } from "./alpha-sms";
import type { SmsProvider } from "./provider.types";

/**
 * The single file a new gateway is added to. Nothing above this picks a
 * provider by name — the service asks for whichever one `SMS_PROVIDER` names.
 */
const providers: Record<SmsProviderKey, SmsProvider> = {
  alpha: alphaSmsProvider
};

export function getSmsProvider(key: SmsProviderKey = readSmsProviderKey()) {
  return providers[key];
}
