"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStore, requireStoreManager } from "../stores/queries";
import { connectStoreOSForStore, sendStoreOSAssistantMessage } from "./storeos.service";

export type StoreOSChatActionResult = {
  connected: boolean;
  message: string;
  suggestions?: string[];
};

export type StoreOSReconnectActionState = {
  message?: string;
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

export async function reconnectStoreOSAction(
  state: StoreOSReconnectActionState,
  formData: FormData
): Promise<StoreOSReconnectActionState> {
  void state;
  void formData;

  try {
    // Asking the assistant a question is ordinary work, but re-establishing the
    // StoreOS connection is an integration change — hence the stricter guard
    // here and `requireStore()` on the chat action above.
    const { store } = await requireStoreManager();
    const connection = await connectStoreOSForStore(store.id);

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/ai");

    return {
      message:
        connection.status === "connected"
          ? "StoreOS is connected."
          : "StoreOS connection is pending. Add StoreOS env variables, then reconnect.",
      status: connection.status === "connected" ? "success" : "error"
    };
  } catch (error) {
    return {
      message: errorMessage(error),
      status: "error"
    };
  }
}

function errorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Please check your StoreOS request.";
  }

  return error instanceof Error ? error.message : "StoreOS request failed.";
}
