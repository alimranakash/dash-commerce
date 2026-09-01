/**
 * The two bring-your-own-key providers, over `fetch`.
 *
 * No SDK on purpose: both calls are one POST returning one JSON body, and a
 * vendor SDK would add a dependency, a bundling question, and a second place
 * the key is handled — for no behaviour this file does not already have.
 *
 * Nothing here reads the environment or the database. The key and model arrive
 * as arguments from `ai-provider.service.ts`, which is the only module that
 * decrypts them, so a caller cannot accidentally reach a credential through
 * this file.
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

/** Long enough for a full product description, short enough not to hang a page. */
const REQUEST_TIMEOUT_MS = 30000;

export class AiProviderError extends Error {
  /** True when retrying could plausibly work — a timeout, a 5xx, a rate limit. */
  readonly retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = "AiProviderError";
    this.retryable = retryable;
  }
}

export type AiCompletionRequest = {
  apiKey: string;
  model: string;
  /** The instruction block: who the model is and what shape to answer in. */
  system: string;
  /** The request itself: this product, these fields. */
  user: string;
};

/**
 * Ask Gemini for one JSON object.
 *
 * `responseMimeType: application/json` rather than trusting the prose: the
 * caller parses the answer into eight named fields, and a model that wraps its
 * JSON in a markdown fence produces a parse error the seller cannot act on.
 * `parseJsonObject` still strips a fence, because "asked for JSON" is not the
 * same as "always gets JSON".
 */
export async function requestGeminiCompletion(request: AiCompletionRequest) {
  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(request.model)}:generateContent`;
  const response = await postJson(
    url,
    {
      contents: [
        {
          parts: [{ text: request.user }],
          role: "user"
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7
      },
      systemInstruction: {
        parts: [{ text: request.system }]
      }
    },
    {
      // The key goes in a header, not the query string: a URL ends up in proxy
      // logs and error messages, and this one is the seller's own billable
      // credential.
      "x-goog-api-key": request.apiKey
    },
    "Gemini"
  );

  const text = readGeminiText(response);

  if (!text) {
    throw new AiProviderError("Gemini returned an empty response.");
  }

  return text;
}

export async function requestOpenAiCompletion(request: AiCompletionRequest) {
  const response = await postJson(
    OPENAI_ENDPOINT,
    {
      messages: [
        { content: request.system, role: "system" },
        { content: request.user, role: "user" }
      ],
      model: request.model,
      response_format: { type: "json_object" },
      temperature: 0.7
    },
    {
      Authorization: `Bearer ${request.apiKey}`
    },
    "OpenAI"
  );

  const text = readOpenAiText(response);

  if (!text) {
    throw new AiProviderError("OpenAI returned an empty response.");
  }

  return text;
}

/**
 * The JSON object a provider answered with, or null.
 *
 * Tolerant of a markdown fence and of leading prose, because both happen and
 * neither is worth failing a seller's click over. Anything that is not an
 * object after that is a null rather than a throw — the caller treats a
 * missing field as "the engine declined it" and falls back.
 */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end <= start) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  providerLabel: string
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      method: "POST",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new AiProviderError(
        await providerErrorMessage(response, providerLabel),
        response.status === 429 || response.status >= 500
      );
    }

    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AiProviderError(`${providerLabel} did not answer in time.`, true);
    }

    throw new AiProviderError(`${providerLabel} could not be reached.`, true);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The provider's own words, when they are useful, and never more than a
 * sentence of them.
 *
 * A seller acting on this needs to know it was their key or their model that
 * was rejected — which both providers do say — and nothing about our request
 * body. The status codes are mapped by hand because "401" alone leaves someone
 * looking at a settings page with no idea which field is wrong.
 */
async function providerErrorMessage(response: Response, providerLabel: string) {
  if (response.status === 401 || response.status === 403) {
    return `${providerLabel} rejected the API key. Check the key in StoreIM AI settings.`;
  }

  if (response.status === 404) {
    return `${providerLabel} does not know that model name. Check the model in StoreIM AI settings.`;
  }

  if (response.status === 429) {
    return `${providerLabel} is rate limiting this key. Try again shortly.`;
  }

  if (response.status >= 500) {
    return `${providerLabel} is having trouble right now. Try again shortly.`;
  }

  const detail = await readErrorDetail(response);

  return detail
    ? `${providerLabel} rejected the request: ${detail}`
    : `${providerLabel} rejected the request.`;
}

async function readErrorDetail(response: Response) {
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: { message?: string } }).error?.message;

    return typeof message === "string" ? message.slice(0, 200) : null;
  } catch {
    return null;
  }
}

function readGeminiText(response: unknown) {
  const candidates = (response as { candidates?: unknown }).candidates;

  if (!Array.isArray(candidates)) {
    return null;
  }

  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;

  if (!Array.isArray(parts)) {
    return null;
  }

  const text = parts
    .map((part) => (part as { text?: unknown }).text)
    .filter((part): part is string => typeof part === "string")
    .join("");

  return text || null;
}

function readOpenAiText(response: unknown) {
  const choices = (response as { choices?: unknown }).choices;

  if (!Array.isArray(choices)) {
    return null;
  }

  const content = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;

  return typeof content === "string" && content ? content : null;
}
