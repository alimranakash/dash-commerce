"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { StoreAccessError, requireStoreManager } from "../stores/queries";
import { AiApiKeyError, issueStoreApiKey, revokeStoreApiKey } from "./ai-key.service";
import { aiScopeSchema, type AiScope } from "./ai.schema";

/**
 * The dashboard's entry points for API key management.
 *
 * `requireStoreManager()` rather than `requireStore()`: issuing a credential
 * that can read the whole catalogue and order book is an integration change, the
 * same class of act as reconnecting StoreOS itself. A MEMBER may see that keys
 * exist; only the owner or an admin may mint one.
 *
 * The guard is re-checked here rather than trusted from the page. The page does
 * render the form disabled for a member, and a disabled input is not a
 * permission check.
 */

const INTEGRATIONS_PATH = "/dashboard/settings/integrations";

export type AiKeyActionState = {
  /**
   * Set only by a successful create, and only for the render that follows it.
   * The raw key is not stored anywhere — this is its one and only appearance,
   * and the next revalidation of the page drops it.
   */
  createdKey?: {
    hint: string;
    id: string;
    key: string;
    name: string;
    scopes: AiScope[];
  };
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle" | "success";
};

export async function createAiApiKeyAction(
  _state: AiKeyActionState,
  formData: FormData
): Promise<AiKeyActionState> {
  try {
    const { store } = await requireStoreManager();
    const issued = await issueStoreApiKey(store.id, {
      expiresAt: text(formData, "expiresAt"),
      name: text(formData, "name"),
      // Only values that are in the vocabulary survive; the service then refuses
      // any that are not grantable yet. A checkbox the browser never rendered
      // cannot become a scope.
      scopes: readScopes(formData)
    });

    revalidatePath(INTEGRATIONS_PATH);

    return {
      createdKey: {
        hint: issued.record.hint,
        id: issued.record.id,
        key: issued.key,
        name: issued.record.name,
        scopes: issued.record.scopes
      },
      message: `"${issued.record.name}" is ready. Copy it now — it is shown once.`,
      status: "success"
    };
  } catch (error) {
    return toErrorState(error, "Could not create that API key.");
  }
}

export async function revokeAiApiKeyAction(
  _state: AiKeyActionState,
  formData: FormData
): Promise<AiKeyActionState> {
  try {
    const { store } = await requireStoreManager();
    const revoked = await revokeStoreApiKey(store.id, text(formData, "apiKeyId"));

    revalidatePath(INTEGRATIONS_PATH);

    if (!revoked) {
      // The key belongs to another store, was already revoked, or never existed
      // — indistinguishable on purpose, so this page cannot be used to probe for
      // key ids that are not this store's.
      return { message: "That key is already revoked.", status: "success" };
    }

    return {
      message: `"${revoked.name}" is revoked. Any request using it now fails.`,
      status: "success"
    };
  } catch (error) {
    return toErrorState(error, "Could not revoke that API key.");
  }
}

function readScopes(formData: FormData): AiScope[] {
  return formData.getAll("scopes").flatMap((value) => {
    const parsed = aiScopeSchema.safeParse(typeof value === "string" ? value : "");

    return parsed.success ? [parsed.data] : [];
  });
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function toErrorState(error: unknown, fallback: string): AiKeyActionState {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path[0];

    return {
      ...(typeof field === "string" && issue ? { fieldErrors: { [field]: issue.message } } : {}),
      message: issue?.message ?? fallback,
      status: "error"
    };
  }

  if (error instanceof StoreAccessError || error instanceof AiApiKeyError) {
    return { message: error.message, status: "error" };
  }

  return { message: fallback, status: "error" };
}
