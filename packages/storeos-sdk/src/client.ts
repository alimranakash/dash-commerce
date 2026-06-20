import type {
  CreateNativeConnectionInput,
  StoreOSActionInput,
  StoreOSActionResponse,
  StoreOSChatMessageInput,
  StoreOSChatMessageResponse,
  StoreOSConnection
} from "./types";

export type StoreOSClientOptions = {
  apiKey?: string;
  apiUrl: string;
  fetcher?: typeof fetch;
};

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
    return this.request<StoreOSConnection>(`/native/connections/${encodeURIComponent(connectionId)}`, {
      method: "GET"
    });
  }

  async sendChatMessage(input: StoreOSChatMessageInput) {
    return this.request<StoreOSChatMessageResponse>("/assistant/chat", {
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

export function isStoreOSConfigured(env: StoreOSEnv = readProcessEnv()) {
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
