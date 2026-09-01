import type { NextRequest } from "next/server";
import { getAiCustomerPage } from "../../../../../modules/ai/ai-customers.service";
import { parseAiQuery, withAiApiRoute } from "../../../../../modules/ai/ai-route";
import { aiCustomerQuerySchema } from "../../../../../modules/ai/ai.schema";
import { getStoreIdentityById } from "../../../../../modules/stores/store.repository";

/**
 * `GET /api/ai/v1/customers` — a page of the customer list.
 *
 * Query: `limit` (1-100, default 25), `cursor`, `search` (name, phone or
 * email). As everywhere on this API, `storeId` in the query string is ignored:
 * the store is `identity.storeId`, which came from the key.
 *
 * Phone numbers and email addresses come back **masked**. A key granted
 * `read:customers` can rank and count a store's customers; it cannot walk away
 * with a contact list. See `ai-customers.service.ts`.
 *
 * The store is read once for its currency, which is the fallback for a customer
 * who has not ordered yet and therefore has no order currency of their own.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withAiApiRoute(request, { scope: "read:customers" }, async (identity, httpRequest) => {
    const store = await getStoreIdentityById(identity.storeId);

    return getAiCustomerPage(
      identity.storeId,
      parseAiQuery(httpRequest, aiCustomerQuerySchema),
      store?.currency ?? "BDT"
    );
  });
}
