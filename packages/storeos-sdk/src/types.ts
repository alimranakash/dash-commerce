export type StoreOSPlatformType = "dash";

export type StoreOSConnectionStatus = "pending" | "connected" | "error" | "disabled";

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

export type CreateNativeConnectionInput = {
  platformType: StoreOSPlatformType;
  store: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    country: string;
    timezone: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  metadata?: StoreOSCapabilities;
};

export type StoreOSConnection = {
  id: string;
  platformType: StoreOSPlatformType;
  status: StoreOSConnectionStatus;
  capabilities: StoreOSCapabilities;
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
