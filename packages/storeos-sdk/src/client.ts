import type {
  CreateNativeConnectionInput,
  StoreOSActionInput,
  StoreOSActionResponse,
  StoreOSChatMessageInput,
  StoreOSChatMessageResponse,
  StoreOSConnection,
  StoreOSProductContentInput,
  StoreOSProductContentResponse
} from "./types";

export type StoreOSClientOptions = {
  apiKey?: string;
  apiUrl: string;
  fetcher?: typeof fetch;
};

/**
 * The *platform* link to StoreOS, not a per-merchant setting.
 *
 * One deployment of DashCommerce talks to one StoreOS installation with one
 * operator-issued credential. A seller never sees, sets, or needs to know these
 * values — `STOREOS_API_KEY` in particular is server-only and must never be
 * serialised into a server-action result, a page prop, or an error message.
 */
export type StoreOSEnv = {
  STOREOS_API_KEY?: string;
  STOREOS_API_URL?: string;
};

export class StoreOSConfigurationError extends Error {
  constructor() {
    super("StoreOS API is not configured.");
    this.name = "StoreOSConfigurationError";
  }
}

export class StoreOSRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StoreOSRequestError";
    this.status = status;
  }
}

export class StoreOSClient {
  private readonly apiKey: string | undefined;
  private readonly apiUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: StoreOSClientOptions) {
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.fetcher = options.fetcher ?? fetch;
  }

  async createNativeConnection(input: CreateNativeConnectionInput) {
    return this.request<StoreOSConnection>("/native/connections", {
      body: input,
      method: "POST"
    });
  }

  async getConnection(connectionId: string) {
    return this.request<StoreOSConnection>(
      `/native/connections/${encodeURIComponent(connectionId)}`,
      {
        method: "GET"
      }
    );
  }

  async sendChatMessage(input: StoreOSChatMessageInput) {
    return this.request<StoreOSChatMessageResponse>("/assistant/chat", {
      body: input,
      method: "POST"
    });
  }

  /**
   * The `ai:product` surface: product copy written from the store's own
   * catalogue row.
   *
   * A separate endpoint rather than an `executeAction` payload because the
   * answer is content the seller reads and edits before anything is saved —
   * `executeAction` is for things StoreOS goes and does, and its response says
   * only whether the work was accepted.
   */
  async generateProductContent(input: StoreOSProductContentInput) {
    return this.request<StoreOSProductContentResponse>("/product/content", {
      body: input,
      method: "POST"
    });
  }

  async executeAction(input: StoreOSActionInput) {
    return this.request<StoreOSActionResponse>("/actions/execute", {
      body: input,
      method: "POST"
    });
  }

  private async request<T>(
    path: string,
    options: {
      body?: unknown;
      method: "GET" | "POST";
    }
  ) {
    if (!this.apiUrl || !this.apiKey) {
      throw new StoreOSConfigurationError();
    }

    const requestInit: RequestInit = {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      method: options.method
    };

    if (options.body) {
      requestInit.body = JSON.stringify(options.body);
    }

    const response = await this.fetcher(`${this.apiUrl}${path}`, requestInit);

    if (!response.ok) {
      throw new StoreOSRequestError(await responseText(response), response.status);
    }

    return (await response.json()) as T;
  }
}

export function createStoreOSClientFromEnv(env: StoreOSEnv = readProcessEnv()) {
  return new StoreOSClient({
    ...(env.STOREOS_API_KEY ? { apiKey: env.STOREOS_API_KEY } : {}),
    apiUrl: env.STOREOS_API_URL ?? ""
  });
}

/**
 * Whether the operator has provisioned this deployment's link to StoreOS.
 *
 * Deliberately not called "configured": it says nothing about whether a given
 * store is connected, and it is not a merchant-facing fact. Callers use it to
 * decide whether clicking Connect could possibly succeed — the answer is folded
 * into a connection state before anything reaches the browser, so the browser
 * learns "StoreIM AI is not available yet", never which variables are unset.
 */
export function isStoreOSLinkProvisioned(env: StoreOSEnv = readProcessEnv()) {
  return Boolean(env.STOREOS_API_URL && env.STOREOS_API_KEY);
}

function readProcessEnv() {
  const runtime = globalThis as typeof globalThis & {
    process?: {
      env?: StoreOSEnv;
    };
  };

  return runtime.process?.env ?? {};
}

async function responseText(response: Response) {
  const text = await response.text();

  if (!text) {
    return `StoreOS request failed with status ${response.status}.`;
  }

  try {
    const data = JSON.parse(text) as {
      error?: string;
      message?: string;
    };

    return data.message ?? data.error ?? text;
  } catch {
    return text;
  }
}
