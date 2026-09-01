import { z } from "zod";
import {
  PRODUCT_CONTENT_LANGUAGES,
  PRODUCT_CONTENT_TONES
} from "../product-content/product-content.schema";

/**
 * Who writes the copy.
 *
 * `storeos` is the platform's own link to the central engine and needs no
 * merchant credential — it is the default, so a store that configures nothing
 * behaves exactly as it did before this setting existed. The other two are the
 * seller bringing their own key, which they pay for and which is encrypted at
 * rest by `lib/secret-box.ts`.
 */
export const AI_PROVIDERS = ["storeos", "gemini", "openai"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** The two that need a key of the seller's own. */
export const BYO_KEY_PROVIDERS = ["gemini", "openai"] as const satisfies readonly AiProvider[];
export type ByoKeyProvider = (typeof BYO_KEY_PROVIDERS)[number];

export const aiProviderSchema = z.enum(AI_PROVIDERS);

export type AiProviderMeta = {
  description: string;
  /**
   * The link text for `keyUrl`, spelled out rather than composed at render
   * time — "a" before Gemini and "an" before OpenAI is not something a template
   * gets right on its own.
   */
  keyCta: string;
  /** Where the seller gets a key. Opened in a new tab, never fetched. */
  keyUrl: string | null;
  label: string;
  modelPlaceholder: string;
};

export const AI_PROVIDER_META: Record<AiProvider, AiProviderMeta> = {
  gemini: {
    description: "Google's Gemini models, billed to your own Google AI Studio key.",
    keyCta: "Get a Gemini key",
    keyUrl: "https://aistudio.google.com/apikey",
    label: "Gemini",
    modelPlaceholder: "gemini-2.5-flash"
  },
  openai: {
    description: "OpenAI's models, billed to your own OpenAI key.",
    keyCta: "Get an OpenAI key",
    keyUrl: "https://platform.openai.com/api-keys",
    label: "OpenAI",
    modelPlaceholder: "gpt-4o-mini"
  },
  storeos: {
    description: "The platform's built-in engine. No key of your own, nothing to bill.",
    keyCta: "",
    keyUrl: null,
    label: "StoreIM AI (built in)",
    modelPlaceholder: ""
  }
};

/**
 * A model id is free text because provider catalogues move faster than this
 * codebase does — pinning an enum here would mean a deploy every time Google or
 * OpenAI ships a model. Kept to the character set the two providers actually
 * use so a pasted sentence is rejected before it reaches a request.
 */
const modelSchema = z
  .string()
  .trim()
  .min(1, "Enter a model name.")
  .max(80, "That model name is too long.")
  .regex(/^[A-Za-z0-9._:-]+$/, "Use a model id such as gemini-2.5-flash or gpt-4o-mini");

/**
 * A submitted key. Blank means "leave whatever is stored alone" — the field
 * renders as "Configured - enter to replace" — so saving the rest of the form
 * never silently wipes a credential the seller cannot read back to retype.
 */
const apiKeySchema = z
  .union([z.string().trim().min(1).max(400), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

/**
 * Two schemas rather than one, because the settings live on two pages.
 *
 * StoreIM AI > Settings owns the provider and its credentials; StoreIM AI > AI
 * Product Content owns how the copy should read. They share a row, so each save
 * merges into what is already stored instead of replacing it — otherwise
 * saving a tone from one page would blank the API key set on the other.
 */
export const aiProviderSettingsSchema = z.object({
  defaultProvider: aiProviderSchema.default("storeos"),
  geminiApiKey: apiKeySchema,
  /** Ticked to remove a stored key, which submitting an empty field cannot mean. */
  geminiApiKeyCleared: z.coerce.boolean().default(false),
  geminiModel: modelSchema.default("gemini-2.5-flash"),
  openaiApiKey: apiKeySchema,
  openaiApiKeyCleared: z.coerce.boolean().default(false),
  openaiModel: modelSchema.default("gpt-4o-mini")
});

export const aiContentDefaultsSchema = z.object({
  brandVoice: z
    .union([z.string().trim().max(500), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : null)),
  contentLanguage: z.enum(PRODUCT_CONTENT_LANGUAGES).default("en"),
  contentTone: z.enum(PRODUCT_CONTENT_TONES).default("friendly")
});

export type AiProviderSettingsInput = z.input<typeof aiProviderSettingsSchema>;
export type AiContentDefaultsInput = z.input<typeof aiContentDefaultsSchema>;

/**
 * What the browser is allowed to know.
 *
 * `*Configured` and `*Hint` replace the keys themselves: the dashboard can say
 * which credential is stored and prove it with the last four characters, and
 * cannot read, echo, or leak the value. Nothing in this type is a secret.
 */
export type AiSettingsView = {
  brandVoice: string | null;
  contentLanguage: (typeof PRODUCT_CONTENT_LANGUAGES)[number];
  contentTone: (typeof PRODUCT_CONTENT_TONES)[number];
  defaultProvider: AiProvider;
  /** False when the server has no encryption key, so no secret can be saved. */
  encryptionConfigured: boolean;
  geminiConfigured: boolean;
  geminiHint: string | null;
  geminiModel: string;
  openaiConfigured: boolean;
  openaiHint: string | null;
  openaiModel: string;
  /** Whether the AI Shopping Agent answers customers on the storefront. */
  shoppingAgentEnabled: boolean;
};

/** Whether the chosen provider can actually run. */
export function isProviderReady(view: AiSettingsView, provider: AiProvider) {
  if (provider === "gemini") {
    return view.geminiConfigured;
  }

  if (provider === "openai") {
    return view.openaiConfigured;
  }

  return true;
}
