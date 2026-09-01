import type { NextRequest } from "next/server";
import { setAiOrderStatus } from "../../../../../../../modules/ai/ai-actions.service";
import { parseAiBody, withAiApiRoute } from "../../../../../../../modules/ai/ai-route";
import { aiOrderStatusBodySchema } from "../../../../../../../modules/ai/ai.schema";

/**
 * `POST /api/ai/v1/orders/[orderId]/status` — move one order along.
 *
 * Body: `status`, one of `PROCESSING`, `COMPLETED`, `CANCELLED` — exactly the
 * three the dashboard's own buttons set. `PENDING` and `CONFIRMED` are not
 * accepted because nothing in the dashboard moves an order *back* into them,
 * and an API that can is an API that can quietly undo a seller's decision.
 *
 * A sub-route rather than a PATCH on the order, and deliberately so: status is
 * the only thing here an assistant may change. Addresses, items and payment
 * state are not reachable at all, which is a stronger guarantee than a patch
 * body that happens to ignore them today.
 *
 * Setting the status an order already has is a no-op that reports the current
 * state rather than claiming a change — see `setAiOrderStatus`.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A write spends more of the key's allowance than a read. See `AiRouteOptions`. */
const WRITE_COST = 5;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;

  return withAiApiRoute(
    request,
    { cost: WRITE_COST, scope: "write:orders" },
    async (identity, httpRequest) =>
      setAiOrderStatus({
        actor: {
          keyHint: identity.keyHint,
          keyId: identity.keyId,
          keyName: identity.keyName
        },
        body: await parseAiBody(httpRequest, aiOrderStatusBodySchema),
        orderId,
        storeId: identity.storeId
      })
  );
}
