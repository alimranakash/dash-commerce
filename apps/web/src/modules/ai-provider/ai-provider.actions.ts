"use server";

import { revalidatePath } from "next/cache";
import { requireStoreManager } from "../stores/queries";
import type {
  PRODUCT_CONTENT_LANGUAGES,
  PRODUCT_CONTENT_TONES
} from "../product-content/product-content.schema";
import {
  AiSettingsError,
  saveAiContentDefaults,
  saveAiProviderSettings
} from "./ai-provider.service";
import type { AiProvider, AiSettingsView } from "./ai-provider.schema";

export type AiSettingsActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "success" | "error";
  /** The saved settings, so the form re-renders from the server's word for it. */
  view?: AiSettingsView;
};

/**
 * Save the store's AI provider and its credentials.
 *
 * `requireStoreManager()` rather than `requireStore()`: this form holds a
 * billable credential and decides which engine everyone in the store spends
 * money through. That is an integration change, the same class of act as
 * `reconnectStoreOSAction` and the marketing settings — while writing product
 * copy *with* the result stays ordinary work any member may do.
 *
 * The store is resolved from the session, so nothing in `formData` chooses
 * which store is configured. What comes back is a view: booleans and last-four
 * hints, never a key.
 */
export async function saveAiProviderSettingsAction(
  _state: AiSettingsActionState,
  formData: FormData
): Promise<AiSettingsActionState> {
  try {
    const { store } = await requireStoreManager();
    const view = await saveAiProviderSettings(store.id, {
      defaultProvider: text(formData, "defaultProvider") as AiProvider,
      geminiApiKey: text(formData, "geminiApiKey"),
      geminiApiKeyCleared: formData.get("geminiApiKeyCleared") === "on",
      geminiModel: text(formData, "geminiModel"),
      openaiApiKey: text(formData, "openaiApiKey"),
      openaiApiKeyCleared: formData.get("openaiApiKeyCleared") === "on",
      openaiModel: text(formData, "openaiModel")
    });

    revalidatePath("/dashboard/ai/settings");
    revalidatePath("/dashboard/ai/product-content");

    return { message: "AI provider saved.", status: "success", view };
  } catch (error) {
    return errorState(error, "AI provider could not be saved.");
  }
}

/**
 * Save the register every product-content draft starts from.
 *
 * Also manager-only, and for the same reason as the provider above rather than
 * a different one: brand voice is store-wide copy policy, not a per-draft
 * choice, and every member's generated drafts inherit it.
 */
export async function saveAiContentDefaultsAction(
  _state: AiSettingsActionState,
  formData: FormData
): Promise<AiSettingsActionState> {
  try {
    const { store } = await requireStoreManager();
    const view = await saveAiContentDefaults(store.id, {
      brandVoice: text(formData, "brandVoice"),
      contentLanguage: text(
        formData,
        "contentLanguage"
      ) as (typeof PRODUCT_CONTENT_LANGUAGES)[number],
      contentTone: text(formData, "contentTone") as (typeof PRODUCT_CONTENT_TONES)[number]
    });

    revalidatePath("/dashboard/ai/product-content");

    return { message: "Content defaults saved.", status: "success", view };
  } catch (error) {
    return errorState(error, "Content defaults could not be saved.");
  }
}

function errorState(error: unknown, fallback: string): AiSettingsActionState {
  if (error instanceof AiSettingsError) {
    return {
      fieldErrors: error.fieldErrors,
      message: error.message,
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : fallback,
    status: "error"
  };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
