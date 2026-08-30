import {
  createStoreOSClientFromEnv,
  isStoreOSLinkProvisioned,
  StoreOSConfigurationError,
  type StoreOSCapabilities,
  type StoreOSChatMessageResponse
} from "@dash/storeos-sdk";
import { requestedCapabilities } from "./storeos-capabilities";
import { toStoreOSConnectionView, type StoreOSConnectionView } from "./storeos-connection-state";
import { buildStoreOSConnectionIdentity } from "./storeos-identity";
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

/**
 * What the chat says when there is no engine behind it.
 *
 * One constant rather than a sentence per branch, because this is the string
 * that gets deleted when the StoreOS central AI engine lands: a seller must not
 * be told to go and configure anything, and the wording must not vary by which
 * internal condition failed. The suggested prompts are kept alongside it so the
 * unconnected chat still demonstrates what StoreIM AI is for.
 */
const FALLBACK_MESSAGE =
  "Dash AI is not connected yet, so I cannot answer from your store data. Connect it from Dash AI > Settings and ask again.";

const FALLBACK_SUGGESTIONS = [
  "আজ কত অর্ডার এসেছে?",
  "এই মাসে মোট বিক্রি কত?",
  "কম স্টক পণ্যগুলো দেখাও"
];

export async function getStoreOSConnection(storeId: string) {
  return getStoreOSConnectionForStore(storeId);
}

/**
 * The connection as the dashboard should render it.
 *
 * Pages call this instead of reading the row, so the operator's link state is
 * folded in on the server and the browser receives a phase and a sentence — not
 * a credential, not a URL, and not the fact that either exists.
 */
export async function getStoreOSConnectionView(storeId: string): Promise<StoreOSConnectionView> {
  const connection = await getStoreOSConnectionForStore(storeId);

  return toStoreOSConnectionView(connection, isStoreOSLinkProvisioned());
}

/**
 * Establish (or re-establish) this store's connection to StoreOS.
 *
 * `storeId` is the only parameter and must already have come from a store guard.
 * Everything StoreOS is told is re-derived from that store's own row by
 * `buildStoreOSConnectionIdentity` — so there is no field in the request a
 * browser could set to make DashCommerce connect a different shop, and no path
 * where a merchant supplies credentials of their own. The platform credential
 * lives in the operator's environment and never leaves this process.
 *
 * When the platform link is not provisioned the row is left `pending` rather
 * than `error`: nothing failed, the feature simply is not switched on yet, and a
 * store that shows an error the seller cannot act on is worse than one that
 * shows it is not connected.
 */
export async function connectStoreOSForStore(storeId: string) {
  if (!isStoreOSLinkProvisioned()) {
    return ensurePendingStoreOSConnection(storeId);
  }

  const identity = await buildStoreOSConnectionIdentity(storeId);

  try {
    const connection = await createStoreOSClientFromEnv().createNativeConnection({
      metadata: {
        source: "dash",
        storeDomain: identity.store.customDomain ?? identity.store.subdomain,
        storefrontUrl: identity.store.storefrontUrl
      },
      organization: identity.organization,
      platformType: "dash",
      requestedCapabilities: requestedCapabilities(),
      store: identity.store
    });

    return upsertStoreOSConnectionForStore({
      capabilities: {
        ...connection.capabilities,
        granted: connection.grantedCapabilities ?? []
      },
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

/**
 * The chat capability, and the only one wired to StoreOS today.
 *
 * The shape is the one every future capability will follow: resolve the store's
 * connection, refuse politely when there is not a usable one, otherwise hand the
 * message plus the server-derived context to StoreOS and return what comes back.
 * No prompt, no model choice, and no provider call lives on this side — replacing
 * the fallback below with the real engine is a change to StoreOS, not to the
 * AI Assistant page.
 */
export async function sendStoreOSAssistantMessage(
  storeId: string,
  input: StoreOSChatInput
): Promise<StoreOSAssistantResponse> {
  const data = storeOSChatSchema.parse(input);
  const connection = await ensureStoreOSConnectionForStore(storeId);

  if (!isStoreOSLinkProvisioned()) {
    return fallbackResponse();
  }

  if (!connection.storeosConnectionId || connection.status !== "connected") {
    return fallbackResponse();
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
  } catch {
    // The reason is an integration detail — a URL, a status code, sometimes a
    // remote error body. The seller gets the one fallback sentence instead.
    return fallbackResponse();
  }
}

function assistantContext(storeId: string): StoreOSCapabilities {
  return {
    platformType: "dash",
    storeId
  };
}

function fallbackResponse(): StoreOSAssistantResponse {
  return {
    connected: false,
    message: FALLBACK_MESSAGE,
    suggestions: [...FALLBACK_SUGGESTIONS]
  };
}

/**
 * One sentence for every way the connection attempt can fail.
 *
 * Deliberately not the underlying message. A `StoreOSRequestError` carries the
 * remote response body; a transport failure carries Node's "fetch failed"; both
 * end up in front of a seller whose only available action is to try again. The
 * detail belongs in the server log, not in the panel.
 */
function storeOSError(error: unknown) {
  void error;

  return new Error("Dash AI could not be reached. Try connecting again.");
}
