import type { NextRequest } from "next/server";
import { getAiInventoryPage } from "../../../../../modules/ai/ai-inventory.service";
import { parseAiQuery, withAiApiRoute } from "../../../../../modules/ai/ai-route";
import { aiInventoryQuerySchema } from "../../../../../modules/ai/ai.schema";

/**
 * `GET /api/ai/v1/inventory` — stock levels, lowest first.
 *
 * Query: `limit` (1-100, default 25), `cursor`, `filter` — `all` (default),
 * `low` (at or under the product's own threshold) or `out` (zero or below).
 *
 * Behind `read:products` rather than a scope of its own: this is the catalogue
 * seen from a different angle, and a key trusted with the products list is
 * already trusted with the stock numbers on it.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withAiApiRoute(request, { scope: "read:products" }, async (identity, httpRequest) =>
    getAiInventoryPage(identity.storeId, parseAiQuery(httpRequest, aiInventoryQuerySchema))
  );
}
