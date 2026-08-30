export type StoreOSPlatformType = "dash";

export type StoreOSConnectionStatus = "pending" | "connected" | "error" | "disabled";

/**
 * The StoreIM AI capability surface.
 *
 * StoreOS is the central AI engine; DashCommerce is one of its callers. A
 * connection therefore negotiates *what this store may ask for* rather than
 * hard-coding chat as the only thing StoreIM AI does. Every entry below except
 * `ai:chat` is declared and not yet implemented on either side — the vocabulary
 * is settled first so the connection row, the wire format and the docs do not
 * have to change again when Product AI or Marketing AI land.
 *
 * Adding one is a code change, not a migration: granted capabilities are stored
 * in `StoreOSConnection.capabilities`, which is JSON.
 */
export const STOREOS_AI_CAPABILITIES = [
  "ai:analytics",
  "ai:automation",
  "ai:chat",
  "ai:customer",
  "ai:marketing",
  "ai:order",
  "ai:product"
] as const;

export type StoreOSAiCapability = (typeof STOREOS_AI_CAPABILITIES)[number];

export type StoreOSJsonValue =
  | boolean
  | number
  | string
  | null
  | StoreOSJsonValue[]
  | {
      [key: string]: StoreOSJsonValue;
    };

export type StoreOSCapabilities = Record<string, StoreOSJsonValue>;

/**
 * Who the connecting store *is*, as StoreOS will know it.
 *
 * Every field is derived server-side from the authenticated store row. None of
 * it may originate in a browser request: the whole point of the envelope is that
 * StoreOS can trust `id` to be the store DashCommerce actually authenticated,
 * not a selector somebody typed into a form. See `buildStoreOSStoreIdentity`.
 *
 * `subdomain` is always present because every store gets one at creation;
 * `customDomain` appears only once a `CUSTOM` domain is verified, and
 * `storefrontUrl` is whichever of the two the shop is actually reached at.
 */
export type StoreOSStoreIdentity = {
  country: string;
  currency: string;
  customDomain?: string;
  id: string;
  name: string;
  slug: string;
  storefrontUrl: string;
  subdomain: string;
  timezone: string;
};

export type CreateNativeConnectionInput = {
  metadata?: StoreOSCapabilities;
  organization?: {
    id: string;
    name: string;
  };
  platformType: StoreOSPlatformType;
  /** What this store is asking to be able to do. StoreOS decides what it gets. */
  requestedCapabilities: StoreOSAiCapability[];
  store: StoreOSStoreIdentity;
};

export type StoreOSConnection = {
  id: string;
  platformType: StoreOSPlatformType;
  status: StoreOSConnectionStatus;
  capabilities: StoreOSCapabilities;
  /** What StoreOS actually granted, which may be narrower than what was asked. */
  grantedCapabilities?: StoreOSAiCapability[];
  createdAt?: string;
  updatedAt?: string;
};

export type StoreOSChatMessageInput = {
  connectionId: string;
  message: string;
  locale?: string;
  context?: StoreOSCapabilities;
};

export type StoreOSChatMessageResponse = {
  message: string;
  conversationId?: string;
  suggestions?: string[];
  actions?: Array<{
    id: string;
    label: string;
    type: string;
    payload?: StoreOSCapabilities;
  }>;
};

export type StoreOSActionInput = {
  actionId: string;
  connectionId: string;
  payload?: StoreOSCapabilities;
};

export type StoreOSActionResponse = {
  status: "accepted" | "queued" | "unsupported";
  message?: string;
};
