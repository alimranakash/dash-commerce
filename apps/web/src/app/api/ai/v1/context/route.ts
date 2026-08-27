import type { NextRequest } from "next/server";
import { getAiStoreContext } from "../../../../../modules/ai/ai-context.service";
import { AiApiRouteError, withAiApiRoute } from "../../../../../modules/ai/ai-route";

/**
 * `GET /api/ai/v1/context` — the identity of the store this key belongs to.
 *
 * The first endpoint of the external AI API, and deliberately the smallest one
 * that is worth anything: it is how StoreOS AI proves a key works, learns which
 * shop it is talking to, and learns the currency and timezone it must format
 * everything else in. No counts, no customers, no money.
 *
 * Note what this handler does *not* do. It does not authenticate, check a scope,
 * throttle, or shape an error — `withAiApiRoute` does all of that, so there is
 * exactly one implementation of it for every endpoint that follows. And it never
 * reads a store id from the request: `identity.storeId` comes from the API key,
 * which is the only thing on this API allowed to say who the tenant is.
 *
 * `/api/**` is excluded from the proxy matcher, so this answers identically on
 * the app host, a tenant subdomain and a custom domain — StoreOS AI is given one
 * base URL and never has to care which hostname resolves where.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withAiApiRoute(request, { scope: "read:store" }, async (identity) => {
    const context = await getAiStoreContext(identity.storeId);

    if (!context) {
      // The key authenticated but its store has gone. Treated as a 404 rather
      // than a 500: nothing is broken, the tenant simply no longer exists.
      throw new AiApiRouteError(404, "store_not_found", "This store no longer exists.");
    }

    return context;
  });
}
