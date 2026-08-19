import { NextResponse, type NextRequest } from "next/server";
import { receiveCourierWebhook } from "../../../../../modules/courier/courier-webhook.service";

/**
 * The courier callback endpoint — one URL per courier account, identified by the
 * opaque token in the path.
 *
 * Provider-agnostic by construction: this handler knows how to read a request
 * and nothing about any carrier. Auth scheme, payload shape and the
 * acknowledgement a carrier insists on all live in that provider's webhook
 * adapter, so adding RedX later touches `providers/redx/` and not this file.
 *
 * `/api/**` is excluded from the proxy matcher, so this answers identically on
 * the app host, a tenant subdomain and a custom domain — which matters because a
 * seller pastes one URL into a merchant panel and it must not depend on which
 * hostname the carrier resolves.
 *
 * Answers 200 to everything it can identify, including payloads it deliberately
 * skips. Carriers disable an endpoint that keeps returning errors, and losing
 * future delivery updates is far worse than quietly ignoring one ping.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  // Read the body once, as text: a carrier that signs its payload signs the
  // exact bytes, and re-serialising parsed JSON would not reproduce them.
  const rawBody = await request.text();

  const result = await receiveCourierWebhook(token, {
    body: parseJson(rawBody),
    headers: toHeaderRecord(request),
    rawBody
  });

  return NextResponse.json(
    { ok: result.status === 200, reason: result.reason, updated: result.applied },
    {
      headers: { "cache-control": "no-store", ...result.ackHeaders },
      status: result.status
    }
  );
}

/**
 * Some carriers send `application/x-www-form-urlencoded` on test pings even when
 * they document JSON. Handing the adapter `null` rather than throwing lets it
 * answer IGNORED, which is a 200 — the alternative is a 500 that reads to the
 * carrier as a broken endpoint.
 */
function parseJson(rawBody: string): unknown {
  if (!rawBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

/** Lowercased once here so no adapter has to guess at header casing. */
function toHeaderRecord(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return headers;
}
