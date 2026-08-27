import type { NextRequest } from "next/server";
import { getAiProductPage } from "../../../../../modules/ai/ai-products.service";
import { parseAiQuery, withAiApiRoute } from "../../../../../modules/ai/ai-route";
import { aiProductQuerySchema } from "../../../../../modules/ai/ai.schema";

/**
 * `GET /api/ai/v1/products` — a page of the catalogue.
 *
 * Query: `limit` (1–100, default 25), `cursor`, `search` (title or SKU),
 * `status`. Anything else is ignored, `storeId` very much included — the store
 * is `identity.storeId`, which came from the API key.
 *
 * `withAiApiRoute` does authentication, the `read:products` check, throttling
 * and error shaping, so what is left here is one call and one redaction pass.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withAiApiRoute(request, { scope: "read:products" }, async (identity, httpRequest) =>
    getAiProductPage(identity.storeId, parseAiQuery(httpRequest, aiProductQuerySchema))
  );
}
