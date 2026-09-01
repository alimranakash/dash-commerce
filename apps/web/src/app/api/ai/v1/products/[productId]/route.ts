import type { NextRequest } from "next/server";
import { updateAiProduct } from "../../../../../../modules/ai/ai-actions.service";
import { parseAiBody, withAiApiRoute } from "../../../../../../modules/ai/ai-route";
import { aiProductUpdateBodySchema } from "../../../../../../modules/ai/ai.schema";

/**
 * `PATCH /api/ai/v1/products/[productId]` — edit one product.
 *
 * Body: any of `title`, `shortDescription`, `description`, `price`,
 * `compareAtPrice`, `stockQuantity`, `status`, `visibility`, and the content
 * fields `seoTitle`, `metaDescription`, `keywords`, `features`,
 * `socialCaption`. **A field that is absent is left alone**, so a patch that
 * fixes a description cannot blank the price beside it.
 *
 * PATCH rather than PUT for exactly that reason: a full replace would make the
 * assistant responsible for echoing back every field it did not mean to touch,
 * and the first time it forgot one the seller would lose it.
 *
 * `productId` is matched against the key's store before anything is written, so
 * an id from another tenant is a 404 rather than someone else's product. There
 * is deliberately no POST here: the AI may edit the catalogue, not invent it.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params;

  return withAiApiRoute(
    request,
    { cost: WRITE_COST, scope: "write:products" },
    async (identity, httpRequest) =>
      updateAiProduct({
        actor: {
          keyHint: identity.keyHint,
          keyId: identity.keyId,
          keyName: identity.keyName
        },
        body: await parseAiBody(httpRequest, aiProductUpdateBodySchema),
        productId,
        storeId: identity.storeId
      })
  );
}

/** A write spends more of the key's allowance than a read. See `AiRouteOptions`. */
const WRITE_COST = 5;
