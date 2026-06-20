import {
  createStoreOSClientFromEnv,
  isStoreOSConfigured,
  StoreOSConfigurationError,
  StoreOSRequestError,
  type StoreOSCapabilities,
  type StoreOSChatMessageResponse
} from "@dash/storeos-sdk";
import { prisma } from "@dash/db";
import {
  ensurePendingStoreOSConnection,
  getStoreOSConnectionForStore,
  markStoreOSConnectionError,
  upsertStoreOSConnectionForStore
} from "./storeos.repository";
import { storeOSChatSchema, type StoreOSChatInput } from "./storeos.schema";

export type StoreOSAssistantResponse = StoreOSChatMessageResponse & {
  connected: boolean;
};

export async function getStoreOSConnection(storeId: string) {
  return getStoreOSConnectionForStore(storeId);
}

export async function connectStoreOSForStore(storeId: string) {
  if (!isStoreOSConfigured()) {
    return ensurePendingStoreOSConnection(storeId);
  }

  const store = await prisma.store.findUnique({
    where: {
      id: storeId
    },
    include: {
      organization: true
    }
  });

  if (!store) {
    throw new Error("Store not found.");
  }

  try {
    const connection = await createStoreOSClientFromEnv().createNativeConnection({
      metadata: {
        source: "dash",
        storeDomain: `${store.slug}.dash.com`
      },
      organization: {
        id: store.organization.id,
        name: store.organization.name
      },
      platformType: "dash",
      store: {
        country: store.country,
        currency: store.currency,
        id: store.id,
        name: store.name,
        slug: store.slug,
        timezone: store.timezone
      }
    });

    return upsertStoreOSConnectionForStore({
      capabilities: connection.capabilities,
      lastSyncedAt: new Date(),
      status: connection.status === "connected" ? "connected" : "pending",
      storeId,
      storeosConnectionId: connection.id
    });
  } catch (error) {
    if (error instanceof StoreOSConfigurationError) {
      return ensurePendingStoreOSConnection(storeId);
    }

    await markStoreOSConnectionError(storeId);
    throw storeOSError(error);
  }
}

export async function ensureStoreOSConnectionForStore(storeId: string) {
  const connection = await getStoreOSConnectionForStore(storeId);

  if (connection) {
    return connection;
  }

  return connectStoreOSForStore(storeId);
}

export async function sendStoreOSAssistantMessage(
  storeId: string,
  input: StoreOSChatInput
): Promise<StoreOSAssistantResponse> {
  const data = storeOSChatSchema.parse(input);
  const connection = await ensureStoreOSConnectionForStore(storeId);

  if (!isStoreOSConfigured()) {
    return fallbackResponse("StoreOS AI Assistant is not connected yet. Add STOREOS_API_URL and STOREOS_API_KEY to enable it.");
  }

  if (!connection.storeosConnectionId || connection.status !== "connected") {
    return fallbackResponse("StoreOS connection is pending. Reconnect StoreOS from settings, then try again.");
  }

  try {
    const response = await createStoreOSClientFromEnv().sendChatMessage({
      connectionId: connection.storeosConnectionId,
      context: assistantContext(storeId),
      locale: "bn-BD",
      message: data.message
    });

    return {
      ...response,
      connected: true
    };
  } catch (error) {
    return fallbackResponse(storeOSError(error).message);
  }
}

function assistantContext(storeId: string): StoreOSCapabilities {
  return {
    platformType: "dash",
    storeId
  };
}

function fallbackResponse(message: string): StoreOSAssistantResponse {
  return {
    connected: false,
    message,
    suggestions: [
      "আজ কত অর্ডার এসেছে?",
      "এই মাসে মোট বিক্রি কত?",
      "কম স্টক পণ্যগুলো দেখাও"
    ]
  };
}

function storeOSError(error: unknown) {
  if (error instanceof StoreOSRequestError) {
    return new Error(`StoreOS request failed: ${error.message}`);
  }

  return error instanceof Error ? error : new Error("StoreOS request failed.");
}
