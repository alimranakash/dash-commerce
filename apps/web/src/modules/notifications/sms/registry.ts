import type { SmsProviderKey } from "../notifications.config";
import { alphaSmsProvider } from "./alpha-sms";
import type { SmsProvider } from "./provider.types";

/**
 * The single file a new gateway is added to. Nothing above this picks a
 * provider by name — the service asks for whichever one the settings name.
 */
const providers: Record<SmsProviderKey, SmsProvider> = {
  alpha: alphaSmsProvider
};

export function getSmsProvider(key: SmsProviderKey) {
  return providers[key];
}
