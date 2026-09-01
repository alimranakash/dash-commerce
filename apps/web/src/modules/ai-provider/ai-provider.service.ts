import type { z } from "zod";
import {
  decryptSecret,
  encryptSecret,
  isSecretEncryptionConfigured,
  secretHintFor
} from "../../lib/secret-box";
import {
  PRODUCT_CONTENT_LANGUAGES,
  PRODUCT_CONTENT_TONES,
  type ProductContentLanguage,
  type ProductContentTone
} from "../product-content/product-content.schema";
import {
  getStoreAiSettingRecord,
  upsertStoreAiSettingRecord,
  type StoreAiSettingRecord
} from "./ai-provider.repository";
import {
  aiContentDefaultsSchema,
  aiProviderSchema,
  aiProviderSettingsSchema,
  type AiContentDefaultsInput,
  type AiProvider,
  type AiProviderSettingsInput,
  type AiSettingsView,
  type ByoKeyProvider
} from "./ai-provider.schema";

export class AiSettingsError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.fieldErrors = fieldErrors;
    this.name = "AiSettingsError";
  }
}

const DEFAULTS: StoreAiSettingRecord = {
  brandVoice: null,
  contentLanguage: "en",
  contentTone: "friendly",
  defaultProvider: "storeos",
  geminiApiKeyCipher: null,
  geminiApiKeyHint: null,
  geminiModel: "gemini-2.5-flash",
  openaiApiKeyCipher: null,
  openaiApiKeyHint: null,
  openaiModel: "gpt-4o-mini",
  shoppingAgentEnabled: false
};

/**
 * The settings as the dashboard may see them.
 *
 * The ciphers are collapsed to `*Configured` booleans and `*Hint` strings here,
 * on the server, so no page prop and no action result can carry a key. This is
 * the same boundary `toStoreOSConnectionView` draws for the platform credential
 * — the difference being that this credential is the seller's own, so they are
 * told which one is stored and shown its last four characters.
 */
export async function getAiSettingsView(storeId: string): Promise<AiSettingsView> {
  const record = (await getStoreAiSettingRecord(storeId)) ?? DEFAULTS;

  return {
    brandVoice: record.brandVoice,
    contentLanguage: readLanguage(record.contentLanguage),
    contentTone: readTone(record.contentTone),
    defaultProvider: readProvider(record.defaultProvider),
    encryptionConfigured: isSecretEncryptionConfigured(),
    geminiConfigured: Boolean(record.geminiApiKeyCipher),
    geminiHint: record.geminiApiKeyHint,
    geminiModel: record.geminiModel,
    openaiConfigured: Boolean(record.openaiApiKeyCipher),
    openaiHint: record.openaiApiKeyHint,
    openaiModel: record.openaiModel,
    shoppingAgentEnabled: record.shoppingAgentEnabled
  };
}

/**
 * Save the storefront agent's switch, leaving every other column alone.
 *
 * The same merge the other two saves do, for the same reason: the three forms
 * share one row, so a save from the storefront-agent card must not blank the
 * API key set on the provider card above it.
 */
export async function saveShoppingAgentSettings(storeId: string, input: { enabled: boolean }) {
  const existing = (await getStoreAiSettingRecord(storeId)) ?? DEFAULTS;

  await upsertStoreAiSettingRecord(storeId, {
    ...existing,
    shoppingAgentEnabled: Boolean(input.enabled)
  });

  return getAiSettingsView(storeId);
}

/**
 * Whether the AI Shopping Agent should appear on this shop's storefront.
 *
 * Read on every storefront render, so it is deliberately one row and no
 * decryption — the entitlement and the provider are resolved separately by
 * `getShoppingAgentCapability`, which is the only place all three meet.
 */
export async function isShoppingAgentEnabled(storeId: string) {
  const record = await getStoreAiSettingRecord(storeId);

  return Boolean(record?.shoppingAgentEnabled);
}

/**
 * Save the provider half, resolving each key to set / clear / keep.
 *
 * An empty key field means **keep**, never clear: the field renders as
 * "Configured - enter to replace" precisely because the seller cannot read the
 * stored value back to retype it, so saving a changed model must not cost them
 * their credential. Clearing is the explicit checkbox — the same shape
 * `marketing.service.ts` uses for the Conversions API token.
 *
 * The content-defaults columns are carried through from the existing row rather
 * than defaulted, so this save cannot reach across to the other page's form.
 */
export async function saveAiProviderSettings(storeId: string, input: AiProviderSettingsInput) {
  const data = parseOrThrow(aiProviderSettingsSchema, input);
  const existing = (await getStoreAiSettingRecord(storeId)) ?? DEFAULTS;
  const gemini = resolveKeyAction({
    cleared: data.geminiApiKeyCleared,
    hadKey: Boolean(existing.geminiApiKeyCipher),
    submitted: data.geminiApiKey
  });
  const openai = resolveKeyAction({
    cleared: data.openaiApiKeyCleared,
    hadKey: Boolean(existing.openaiApiKeyCipher),
    submitted: data.openaiApiKey
  });

  if ((gemini === "set" || openai === "set") && !isSecretEncryptionConfigured()) {
    throw new AiSettingsError(
      "Set COURIER_CREDENTIALS_KEY (or SECRETS_ENCRYPTION_KEY) in the root .env before saving an API key — it is stored encrypted.",
      {
        ...(gemini === "set"
          ? { geminiApiKey: "Encryption key is not configured on this server." }
          : {}),
        ...(openai === "set"
          ? { openaiApiKey: "Encryption key is not configured on this server." }
          : {})
      }
    );
  }

  const willHaveGemini =
    gemini === "set" || (gemini === "keep" && Boolean(existing.geminiApiKeyCipher));
  const willHaveOpenai =
    openai === "set" || (openai === "keep" && Boolean(existing.openaiApiKeyCipher));

  // Refused rather than silently downgraded to StoreIM AI: a seller who picks a
  // provider and saves expects that provider, and finding out later that every
  // draft came from somewhere else is worse than being told now.
  if (data.defaultProvider === "gemini" && !willHaveGemini) {
    throw new AiSettingsError("Add a Gemini API key before making Gemini the default provider.", {
      geminiApiKey: "Required to use Gemini as the default provider."
    });
  }

  if (data.defaultProvider === "openai" && !willHaveOpenai) {
    throw new AiSettingsError("Add an OpenAI API key before making OpenAI the default provider.", {
      openaiApiKey: "Required to use OpenAI as the default provider."
    });
  }

  await upsertStoreAiSettingRecord(storeId, {
    brandVoice: existing.brandVoice,
    contentLanguage: existing.contentLanguage,
    contentTone: existing.contentTone,
    defaultProvider: resolveDefaultProvider({
      gemini,
      openai,
      requested: data.defaultProvider
    }),
    geminiApiKeyCipher: resolveCipher(gemini, data.geminiApiKey, existing.geminiApiKeyCipher),
    geminiApiKeyHint: resolveHint(gemini, data.geminiApiKey, existing.geminiApiKeyHint),
    geminiModel: data.geminiModel,
    openaiApiKeyCipher: resolveCipher(openai, data.openaiApiKey, existing.openaiApiKeyCipher),
    openaiApiKeyHint: resolveHint(openai, data.openaiApiKey, existing.openaiApiKeyHint),
    openaiModel: data.openaiModel,
    // Carried through, not defaulted: this form is not the one that switches the
    // storefront assistant on, and saving a model name must not take it down.
    shoppingAgentEnabled: existing.shoppingAgentEnabled
  });

  return getAiSettingsView(storeId);
}

/**
 * Which provider the store ends up on.
 *
 * Normally whatever the dropdown said. The exception is the one that cost a
 * seller an afternoon: pasting a Gemini key and saving, while the dropdown is
 * still on the built-in engine, stores a credential that nothing then uses —
 * the key is configured, the buttons stay off, and the settings page says
 * nothing is wrong. So adding a key *while the default is still the built-in
 * engine* selects that provider.
 *
 * Deliberately narrow. It only fires when `storeos` is selected, which is the
 * value nobody chooses on purpose because it is the default; switching away
 * from Gemini to the built-in engine on the same save that replaces the Gemini
 * key is left exactly as asked. The dropdown re-renders from the saved view, so
 * the change is visible rather than silent.
 */
function resolveDefaultProvider(params: {
  gemini: "clear" | "keep" | "set";
  openai: "clear" | "keep" | "set";
  requested: AiProvider;
}): AiProvider {
  if (params.requested !== "storeos") {
    return params.requested;
  }

  if (params.gemini === "set") {
    return "gemini";
  }

  return params.openai === "set" ? "openai" : "storeos";
}

/**
 * Save the content half. Every provider column is carried through untouched,
 * for the same reason the provider save carries the content columns.
 */
export async function saveAiContentDefaults(storeId: string, input: AiContentDefaultsInput) {
  const data = parseOrThrow(aiContentDefaultsSchema, input);
  const existing = (await getStoreAiSettingRecord(storeId)) ?? DEFAULTS;

  await upsertStoreAiSettingRecord(storeId, {
    ...existing,
    brandVoice: data.brandVoice,
    contentLanguage: data.contentLanguage,
    contentTone: data.contentTone
  });

  return getAiSettingsView(storeId);
}

/**
 * One validation path for both halves, so the field-error shape the two forms
 * render is produced in one place.
 */
function parseOrThrow<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new AiSettingsError(
      "Please fix the highlighted AI settings.",
      Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      )
    );
  }

  return parsed.data;
}

/**
 * The defaults a generation starts from when the caller names none — the
 * seller's register and standing steer, set once in StoreIM AI settings instead of
 * on every product.
 */
export type AiContentDefaults = {
  brandVoice: string | null;
  language: ProductContentLanguage;
  tone: ProductContentTone;
};

export async function getAiContentDefaults(storeId: string): Promise<AiContentDefaults> {
  const record = (await getStoreAiSettingRecord(storeId)) ?? DEFAULTS;

  return {
    brandVoice: record.brandVoice,
    language: readLanguage(record.contentLanguage),
    tone: readTone(record.contentTone)
  };
}

/**
 * A provider with its credential, ready to call — or null when the store has
 * not configured one.
 *
 * **This is the only function that decrypts a key**, and it is not exported to
 * anything that renders. Callers hand the result straight to
 * `ai-provider-client.ts` and never hold it beyond the request.
 */
export type ResolvedAiProvider = {
  apiKey: string;
  model: string;
  provider: ByoKeyProvider;
};

export async function resolveAiProvider(storeId: string): Promise<ResolvedAiProvider | null> {
  const record = await getStoreAiSettingRecord(storeId);

  if (!record) {
    return null;
  }

  const provider = readProvider(record.defaultProvider);

  if (provider === "storeos") {
    return null;
  }

  const cipher = provider === "gemini" ? record.geminiApiKeyCipher : record.openaiApiKeyCipher;

  if (!cipher) {
    return null;
  }

  // A key that cannot be decrypted — the encryption key changed, or the row was
  // tampered with — reads as "no provider" rather than as an error the seller
  // meets mid-draft. Re-entering it in settings is what fixes it, and that is
  // where they are told so.
  const apiKey = readApiKey(cipher);

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    model: provider === "gemini" ? record.geminiModel : record.openaiModel,
    provider
  };
}

/**
 * Whether this store can generate on a credential it owns.
 *
 * The distinction that matters for entitlement: a Gemini or OpenAI key is the
 * seller's own, billed to their own account, so nothing about the platform's
 * plan should stand between them and it. Only the built-in StoreIM AI engine costs
 * the platform money, and only that is plan-gated.
 */
export async function hasOwnAiProvider(storeId: string) {
  return (await resolveAiProvider(storeId)) !== null;
}

function readApiKey(cipher: string) {
  try {
    return decryptSecret(cipher);
  } catch {
    return null;
  }
}

function resolveKeyAction(params: { cleared: boolean; hadKey: boolean; submitted: string | null }) {
  if (params.submitted) {
    return "set" as const;
  }

  if (params.cleared && params.hadKey) {
    return "clear" as const;
  }

  return "keep" as const;
}

function resolveCipher(
  action: "clear" | "keep" | "set",
  submitted: string | null,
  existing: string | null
) {
  if (action === "set") {
    return encryptSecret(submitted as string);
  }

  return action === "clear" ? null : existing;
}

function resolveHint(
  action: "clear" | "keep" | "set",
  submitted: string | null,
  existing: string | null
) {
  if (action === "set") {
    return secretHintFor(submitted);
  }

  return action === "clear" ? null : existing;
}

/**
 * Text columns are read defensively: they hold whatever was written by whatever
 * version of this code, and an unrecognised value must fall back rather than
 * reach a provider request or a `Record` lookup.
 */
function readProvider(value: string): AiProvider {
  const parsed = aiProviderSchema.safeParse(value);

  return parsed.success ? parsed.data : "storeos";
}

function readTone(value: string): ProductContentTone {
  return (PRODUCT_CONTENT_TONES as readonly string[]).includes(value)
    ? (value as ProductContentTone)
    : "friendly";
}

function readLanguage(value: string): ProductContentLanguage {
  return (PRODUCT_CONTENT_LANGUAGES as readonly string[]).includes(value)
    ? (value as ProductContentLanguage)
    : "en";
}
