import { randomUUID } from "node:crypto";
import { courierProviderFields } from "../settings/settings.schema";
import { getModuleSettingsRecord, updateModuleSettingsRecord } from "../settings/settings.repository";
import {
  decryptCredentials,
  encryptCredentials,
  isCourierEncryptionConfigured,
  secretHintFor
} from "./courier-credentials";
import { CourierError } from "./courier-errors";
import { COURIER_TIMEOUT_MS } from "./courier-http";
import { getCourierBalance, type CourierBalanceView } from "./courier-insight.service";
import {
  getCourierAccountForStore,
  getCourierAccountsForStore,
  setDefaultCourierAccountForStore,
  updateCourierAccountSecretCacheForStore,
  updateCourierAccountTestResultForStore,
  upsertCourierAccountForStore
} from "./courier.repository";
import { listCourierCatalog, requireCourierProvider, type CourierCatalogEntry } from "./providers/registry";
import type { CourierContext, CredentialField } from "./providers/provider.types";

/**
 * Courier account lifecycle: storage, secret handling, and the resolution step
 * that turns a store's stored credentials into a provider context.
 *
 * Secrets are write-only from the UI's point of view. The server hands back a
 * hint (`••••7f2a`) and never the plaintext, and an empty field on save means
 * "keep what is stored" — so a seller can change a base URL without retyping
 * their API secret.
 */

export type CourierAccountView = {
  balance: CourierBalanceView | null;
  /** Plain objects only — this view crosses into a client component. */
  fields: CredentialField[];
  hasCredentials: boolean;
  implemented: boolean;
  isDefault: boolean;
  isEnabled: boolean;
  key: string;
  label: string;
  lastTestMessage: string | null;
  lastTestStatus: string | null;
  lastTestedAt: Date | null;
  /** Non-secret values only, echoed back into the form. */
  publicValues: Record<string, string>;
  secretHints: Record<string, string>;
  tagline: string;
};

export async function listCourierAccountViews(storeId: string): Promise<CourierAccountView[]> {
  await migrateLegacyCourierCredentials(storeId);

  const accounts = await getCourierAccountsForStore(storeId);
  const byProvider = new Map(accounts.map((account) => [account.provider, account]));
  const catalog = listCourierCatalog();
  // Honours the 15-minute TTL, so this refreshes at most once per provider per
  // quarter hour and degrades to a stale figure if the carrier is unreachable.
  const balances = new Map(
    await Promise.all(
      catalog.map(
        async (entry) => [entry.key, await getCourierBalance(storeId, entry.key)] as const
      )
    )
  );

  return catalog.map((entry) => {
    const account = byProvider.get(entry.key) ?? null;
    const publicValues = toStringRecord(account?.credentialsPublic);
    const secretHints = toStringRecord(account?.metadata, "secretHints");

    return {
      balance: balances.get(entry.key) ?? null,
      fields: entry.provider ? [...entry.provider.credentialFields] : [],
      hasCredentials: Boolean(account?.credentialsCipher),
      implemented: entry.implemented,
      isDefault: account?.isDefault ?? false,
      isEnabled: account?.isEnabled ?? false,
      key: entry.key,
      label: entry.label,
      lastTestMessage: account?.lastTestMessage ?? null,
      lastTestStatus: account?.lastTestStatus ?? null,
      lastTestedAt: account?.lastTestedAt ?? null,
      publicValues,
      secretHints,
      tagline: entry.tagline
    };
  });
}

export type SaveCourierAccountInput = {
  isDefault: boolean;
  isEnabled: boolean;
  provider: string;
  /** Raw form values; blank secrets mean "keep the stored one". */
  values: Record<string, string>;
};

export async function saveCourierAccount(storeId: string, input: SaveCourierAccountInput) {
  const provider = requireCourierProvider(input.provider);
  const existing = await getCourierAccountForStore(storeId, provider.key);
  const stored = existing?.credentialsCipher ? decryptCredentials(existing.credentialsCipher) : {};

  const secrets: Record<string, string> = {};
  const publicValues: Record<string, string> = {};
  const missing: string[] = [];

  for (const field of provider.credentialFields) {
    const submitted = input.values[field.name]?.trim() ?? "";
    const value = field.secret ? submitted || stored[field.name] || "" : submitted;

    if (!value) {
      if (field.required) {
        missing.push(field.label);
      }

      continue;
    }

    if (field.secret) {
      secrets[field.name] = value;
    } else {
      publicValues[field.name] = value;
    }
  }

  if (missing.length > 0) {
    throw new CourierError("VALIDATION", `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} required.`);
  }

  await upsertCourierAccountForStore({
    credentialsCipher: encryptCredentials(secrets),
    credentialsPublic: publicValues,
    isDefault: input.isDefault,
    isEnabled: input.isEnabled,
    metadata: { secretHints: buildSecretHints(provider.credentialFields, secrets) },
    provider: provider.key,
    secretHint: secretHintFor(Object.values(secrets)[0]),
    storeId
  });

  if (input.isDefault) {
    await setDefaultCourierAccountForStore(storeId, provider.key);
  }

  return { provider: provider.key };
}

export async function setDefaultCourierAccount(storeId: string, providerKey: string) {
  const provider = requireCourierProvider(providerKey);
  const account = await getCourierAccountForStore(storeId, provider.key);

  if (!account?.credentialsCipher) {
    throw new CourierError("VALIDATION", `Add ${provider.label} credentials before making it the default.`);
  }

  await setDefaultCourierAccountForStore(storeId, provider.key);

  return { provider: provider.key };
}

/**
 * Resolves the account a send should use: the named provider, else the store
 * default, else the only enabled account. One configured carrier is implicitly
 * the default, which is what keeps the send button genuinely one click.
 */
export async function resolveCourierAccount(storeId: string, providerKey?: string) {
  await migrateLegacyCourierCredentials(storeId);

  const accounts = await getCourierAccountsForStore(storeId);
  const usable = accounts.filter((account) => account.isEnabled && account.credentialsCipher);

  if (providerKey) {
    const match = usable.find((account) => account.provider === providerKey);

    if (!match) {
      throw new CourierError("VALIDATION", "That courier is not configured and enabled for this store.");
    }

    return match;
  }

  const preferred = usable.find((account) => account.isDefault) ?? (usable.length === 1 ? usable[0] : undefined);

  if (!preferred) {
    throw new CourierError(
      "VALIDATION",
      usable.length === 0
        ? "No courier is configured yet. Add your credentials in courier settings."
        : "Several couriers are enabled — choose which one to send with, or set a default."
    );
  }

  return preferred;
}

/**
 * What the send button should say, and why it might be disabled. Keeps the
 * "which carrier?" decision in one place instead of in every surface that
 * renders a send control.
 */
export async function describeSendTarget(storeId: string) {
  try {
    const account = await resolveCourierAccount(storeId);
    const provider = requireCourierProvider(account.provider);

    return { label: provider.label, provider: provider.key, reason: null };
  } catch (error) {
    return {
      label: "courier",
      provider: null,
      reason: error instanceof CourierError ? error.message : "No courier is available."
    };
  }
}

export function toCourierContext(
  storeId: string,
  account: {
    credentialsCipher: string | null;
    credentialsPublic: unknown;
    metadata?: unknown;
    provider: string;
  }
): CourierContext {
  let cache: Record<string, string> | null = null;

  return {
    credentials: {
      ...toStringRecord(account.credentialsPublic),
      ...decryptCredentials(account.credentialsCipher)
    },
    requestId: randomUUID(),
    // Encrypted at rest exactly like the seller-entered credentials — an OAuth
    // access token is every bit as sensitive as the password that minted it.
    secretStore: {
      read: async () => {
        cache ??= readSecretCache(account.metadata);

        return { ...cache };
      },
      write: async (values) => {
        cache = { ...(cache ?? readSecretCache(account.metadata)), ...values };

        await updateCourierAccountSecretCacheForStore(
          storeId,
          account.provider,
          encryptCredentials(cache)
        );
      }
    },
    storeId,
    timeoutMs: COURIER_TIMEOUT_MS
  };
}

function readSecretCache(metadata: unknown): Record<string, string> {
  const cipher = toStringRecord(metadata).secretCache;

  if (!cipher) {
    return {};
  }

  try {
    return decryptCredentials(cipher);
  } catch {
    // A rotated COURIER_CREDENTIALS_KEY invalidates the cache, not the account:
    // the adapter simply re-authenticates and writes a fresh one.
    return {};
  }
}

export async function testCourierConnection(storeId: string, providerKey: string) {
  const provider = requireCourierProvider(providerKey);
  const account = await getCourierAccountForStore(storeId, provider.key);

  if (!account?.credentialsCipher) {
    throw new CourierError("VALIDATION", `Add ${provider.label} credentials first.`);
  }

  try {
    const result = await provider.testConnection(toCourierContext(storeId, account));

    await updateCourierAccountTestResultForStore(storeId, provider.key, {
      lastTestMessage: result.message,
      lastTestStatus: result.ok ? "OK" : "FAILED"
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection test failed.";

    await updateCourierAccountTestResultForStore(storeId, provider.key, {
      lastTestMessage: message,
      lastTestStatus: "FAILED"
    });

    throw error;
  }
}

/**
 * One-time move off the plaintext `moduleSettings.courier` JSON.
 *
 * Runs lazily whenever courier accounts are read, and is a no-op once the JSON
 * is empty. Credentials for carriers that are not implemented yet are migrated
 * too — encrypted and left disabled — so nothing a seller typed is lost, while
 * plaintext secrets stop existing in the database either way.
 */
export async function migrateLegacyCourierCredentials(storeId: string) {
  if (!isCourierEncryptionConfigured()) {
    return false;
  }

  const moduleSettings = await getModuleSettingsRecord(storeId);
  const legacy = moduleSettings.courier.providers.filter((entry) =>
    Object.values(entry.credentials ?? {}).some((value) => value?.trim())
  );

  if (legacy.length === 0) {
    return false;
  }

  const existing = await getCourierAccountsForStore(storeId);
  const configured = new Set(
    existing.filter((account) => account.credentialsCipher).map((account) => account.provider)
  );

  for (const entry of legacy) {
    if (configured.has(entry.key)) {
      continue;
    }

    const secrets: Record<string, string> = {};
    const publicValues: Record<string, string> = {};

    for (const name of courierProviderFields[entry.key] ?? []) {
      const value = entry.credentials[name]?.trim();

      if (!value) {
        continue;
      }

      if (isLegacySecretField(name)) {
        secrets[name] = value;
      } else {
        publicValues[name] = value;
      }
    }

    if (Object.keys(secrets).length === 0 && Object.keys(publicValues).length === 0) {
      continue;
    }

    await upsertCourierAccountForStore({
      credentialsCipher: encryptCredentials(secrets),
      credentialsPublic: publicValues,
      isDefault: false,
      // Only carriers we can actually call stay enabled through the move.
      isEnabled: entry.isEnabled && isImplemented(entry.key),
      metadata: { migratedFrom: "moduleSettings.courier", secretHints: buildLegacyHints(secrets) },
      provider: entry.key,
      secretHint: secretHintFor(Object.values(secrets)[0]),
      storeId
    });
  }

  await updateModuleSettingsRecord(storeId, {
    ...moduleSettings,
    courier: { providers: [] }
  });

  return true;
}

function isImplemented(key: string) {
  return listCourierCatalog().some((entry: CourierCatalogEntry) => entry.key === key && entry.implemented);
}

function isLegacySecretField(name: string) {
  return /key|secret|password|token|context/i.test(name);
}

function buildSecretHints(fields: readonly CredentialField[], secrets: Record<string, string>) {
  return Object.fromEntries(
    fields
      .filter((field) => field.secret && secrets[field.name])
      .map((field) => [field.name, secretHintFor(secrets[field.name]) ?? ""])
      .filter(([, hint]) => hint)
  );
}

function buildLegacyHints(secrets: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(secrets)
      .map(([name, value]) => [name, secretHintFor(value) ?? ""])
      .filter(([, hint]) => hint)
  );
}

function toStringRecord(value: unknown, nestedKey?: string): Record<string, string> {
  const source = nestedKey
    ? (value && typeof value === "object" ? (value as Record<string, unknown>)[nestedKey] : null)
    : value;

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(source as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}
