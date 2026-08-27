import type { NextRequest } from "next/server";
import { getAiOrderPage } from "../../../../../modules/ai/ai-orders.service";
import { parseAiQuery, withAiApiRoute } from "../../../../../modules/ai/ai-route";
import { aiOrderQuerySchema } from "../../../../../modules/ai/ai.schema";

/**
 * `GET /api/ai/v1/orders` — a page of the order book, redacted.
 *
 * Query: `limit` (1–100, default 25), `cursor`, `status`.
 *
 * Every row carries `storeId` alongside its `orderNumber`, because an order
 * number is unique per store rather than globally and is ambiguous without it.
 * That store is the authenticated one; there is no parameter that changes it.
 *
 * What comes back is deliberately less than the seller sees: masked phone and
 * email, city and district instead of an address, and nothing at all from the
 * fraud engine. `ai-orders.service.ts` explains each omission.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withAiApiRoute(request, { scope: "read:orders" }, async (identity, httpRequest) =>
    getAiOrderPage(identity.storeId, parseAiQuery(httpRequest, aiOrderQuerySchema))
  );
}
