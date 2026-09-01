"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { PlanFeatureKey } from "../billing/plan-features";
import { PlanFeatureError, requirePlanFeature } from "../billing/subscription-limits";
import { StoreAccessError, requireStoreManager } from "../stores/queries";
import {
  AiApiKeyError,
  deleteStoreApiKey,
  issueStoreApiKey,
  revealStoreApiKey,
  revokeStoreApiKey
} from "./ai-key.service";
import { aiScopeSchema, type AiScope } from "./ai.schema";

/**
 * The dashboard's entry points for API key management.
 *
 * `requireStoreManager()` rather than `requireStore()`: issuing a credential
 * that can read the whole catalogue and order book is an integration change, the
 * same class of act as reconnecting StoreOS itself. A MEMBER may see that keys
 * exist; only the owner or an admin may mint one, read one back, or remove one.
 *
 * The guard is re-checked in every action rather than trusted from the page. The
 * page does render the controls hidden for a member, and a control that is not
 * rendered is not a permission check.
 */

const INTEGRATIONS_PATH = "/dashboard/settings/integrations";

export type AiKeyActionState = {
  /**
   * Set only by a successful create, and only for the render that follows it.
   * Revealing an existing key later fills `revealedKey` instead.
   */
  createdKey?: {
    hint: string;
    id: string;
    key: string;
    name: string;
    scopes: AiScope[];
  };
  fieldErrors?: Record<string, string>;
  /** Set when the plan refused the write, so the form can open the upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  message?: string;
  /** Set by a successful reveal — the stored key, decrypted for this render. */
  revealedKey?: {
    id: string;
    key: string;
    name: string;
  };
  status: "error" | "idle" | "success";
};

export async function createAiApiKeyAction(
  _state: AiKeyActionState,
  formData: FormData
): Promise<AiKeyActionState> {
  try {
    const { store } = await requireStoreManager();

    // Integrations is a Growth feature. Issuing and reading back a credential
    // are what it sells; revoking and deleting are deliberately left open below,
    // so a store that lapses can always shut off access it has already granted.
    await requirePlanFeature(store.id, "api_access");

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
      message: issued.record.canReveal
        ? `"${issued.record.name}" is ready. Copy it now, or read it back from the list below.`
        : `"${issued.record.name}" is ready. Copy it now — this deployment cannot show it again.`,
      status: "success"
    };
  } catch (error) {
    return toErrorState(error, "Could not create that API key.");
  }
}

/**
 * Reads one stored key back for the manager who owns it.
 *
 * No `revalidatePath`: nothing changed, and re-rendering the page here would
 * throw away the very value this call exists to put on screen.
 */
export async function revealAiApiKeyAction(
  _state: AiKeyActionState,
  formData: FormData
): Promise<AiKeyActionState> {
  try {
    const { store } = await requireStoreManager();

    await requirePlanFeature(store.id, "api_access");

    const revealed = await revealStoreApiKey(store.id, text(formData, "apiKeyId"));

    if (!revealed) {
      return {
        message:
          "This key cannot be shown. It was created before keys were kept readable, or the server's encryption key has changed. Create a new key to get one you can read.",
        status: "error"
      };
    }

    return { revealedKey: revealed, status: "success" };
  } catch (error) {
    return toErrorState(error, "Could not show that API key.");
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

export async function deleteAiApiKeyAction(
  _state: AiKeyActionState,
  formData: FormData
): Promise<AiKeyActionState> {
  try {
    const { store } = await requireStoreManager();
    const deleted = await deleteStoreApiKey(store.id, text(formData, "apiKeyId"));

    revalidatePath(INTEGRATIONS_PATH);

    if (!deleted) {
      return { message: "That key is already gone.", status: "success" };
    }

    return {
      message: `"${deleted.name}" is deleted. Any request using it now fails.`,
      status: "success"
    };
  } catch (error) {
    return toErrorState(error, "Could not delete that API key.");
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

  // Carried as a key so the form opens the shared upgrade dialog rather than
  // printing the refusal as though it were a field the seller could fix.
  if (error instanceof PlanFeatureError) {
    return { lockedFeature: error.featureKey, message: error.message, status: "error" };
  }

  if (error instanceof StoreAccessError || error instanceof AiApiKeyError) {
    return { message: error.message, status: "error" };
  }

  return { message: fallback, status: "error" };
}
