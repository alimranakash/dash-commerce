"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStore, requireStoreManager } from "../stores/queries";
import type { StoreOSConnectionPhase } from "./storeos-connection-state";
import {
  connectStoreOSForStore,
  getStoreOSConnectionView,
  sendStoreOSAssistantMessage
} from "./storeos.service";

export type StoreOSChatActionResult = {
  connected: boolean;
  message: string;
  suggestions?: string[];
};

export type StoreOSReconnectActionState = {
  detail?: string;
  message?: string;
  phase?: StoreOSConnectionPhase;
  status: "idle" | "success" | "error";
};

export async function sendStoreOSChatMessageAction(
  message: string
): Promise<StoreOSChatActionResult> {
  const store = await requireStore();

  try {
    const response = await sendStoreOSAssistantMessage(store.id, {
      message
    });

    return {
      connected: response.connected,
      message: response.message,
      ...(response.suggestions ? { suggestions: response.suggestions } : {})
    };
  } catch (error) {
    return {
      connected: false,
      message: errorMessage(error)
    };
  }
}

/**
 * The one entry point behind "Connect / reconnect StoreIM AI".
 *
 * `formData` is accepted because `useActionState` passes it and ignored because
 * nothing in it may be trusted: the store is resolved from the session by
 * `requireStoreManager()`, so a hidden `storeId` field, a `tenantId`, or a
 * query string appended to the action URL changes nothing about which store gets
 * connected. That is the whole tenancy guarantee of this action, and
 * `verify:storeim-ai` asserts it by posting exactly those fields.
 *
 * Asking the assistant a question is ordinary work, but re-establishing the
 * StoreOS connection is an integration change — hence the stricter guard here
 * and `requireStore()` on the chat action above.
 *
 * What comes back is a phase and a sentence. No connection credential, no URL,
 * and no environment state reaches the browser.
 */
export async function reconnectStoreOSAction(
  state: StoreOSReconnectActionState,
  formData: FormData
): Promise<StoreOSReconnectActionState> {
  void state;
  void formData;

  try {
    const { store } = await requireStoreManager();

    await connectStoreOSForStore(store.id);

    const view = await getStoreOSConnectionView(store.id);

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/ai");

    return {
      detail: view.detail,
      message: view.label,
      phase: view.phase,
      status: view.phase === "connected" ? "success" : "error"
    };
  } catch (error) {
    return {
      message: errorMessage(error),
      phase: "failed",
      status: "error"
    };
  }
}

function errorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Please check your Dash AI request.";
  }

  return error instanceof Error ? error.message : "Dash AI request failed.";
}
