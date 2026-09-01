import { createSystemLog } from "../../lib/system-log";
import { createCoupon } from "../coupons/coupon.service";
import { getOrderByIdForStore, updateOrderStatus } from "../orders/order.service";
import { saveProductContentFields } from "../product-content/product-content.service";
import { getProductByIdForStore } from "../products/product.repository";
import { updateProduct } from "../products/product.service";
import { decimalToString, optionalDecimalToString, toIsoString } from "./ai-redact";
import { AiApiRouteError } from "./ai-route";
import {
  aiCouponCreateResponseSchema,
  aiOrderStatusResponseSchema,
  aiProductUpdateResponseSchema,
  type AiCouponCreateBody,
  type AiCouponCreateResponse,
  type AiOrderStatusBody,
  type AiOrderStatusResponse,
  type AiProductUpdateBody,
  type AiProductUpdateResponse
} from "./ai.schema";

/**
 * The three things the AI may change.
 *
 * Every one of them is a thin shell over the service the dashboard's own
 * buttons call — `updateProduct`, `createCoupon`, `updateOrderStatus`. That is
 * the whole safety argument and it is worth stating plainly: the API adds no
 * write path of its own, so slug and SKU uniqueness, coupon invariants, plan
 * gates and the fake-order re-scoring that hangs off a cancellation all still
 * happen, because they live in those services and there is no way around them.
 *
 * `storeId` always arrives from `identity.storeId`, which came from the API key.
 * Every one of these re-reads the target scoped by it before touching anything,
 * so an id belonging to another tenant resolves to nothing and answers 404 —
 * never someone else's row.
 *
 * Each action writes a `SystemLog` entry naming the key that did it. A merchant
 * who lets an assistant edit their catalogue is owed a record of what it
 * changed, and this is the only place that record can be written without
 * trusting the caller to report itself honestly.
 */

export type AiActor = {
  keyHint: string;
  keyId: string;
  keyName: string;
  /**
   * Which surface made the change. Defaults to the external API.
   *
   * The AI Store Copilot runs these same three functions for a merchant sitting
   * in their own dashboard, where the actor is a signed-in user rather than an
   * API key — it passes the user id as `keyId` and their email as `keyHint`, and
   * sets this so the audit line says which of the two it was.
   */
  via?: "ai-api" | "store-copilot" | undefined;
};

/** The `Product` columns a patch may reach, and which service writes them. */
const PRODUCT_COLUMN_FIELDS = [
  "compareAtPrice",
  "description",
  "price",
  "shortDescription",
  "status",
  "stockQuantity",
  "title",
  "visibility"
] as const;

const PRODUCT_CONTENT_FIELDS = [
  "features",
  "keywords",
  "metaDescription",
  "seoTitle",
  "socialCaption"
] as const;

export async function updateAiProduct(params: {
  actor: AiActor;
  body: AiProductUpdateBody;
  productId: string;
  storeId: string;
}): Promise<AiProductUpdateResponse> {
  const { actor, body, productId, storeId } = params;
  const existing = await getProductByIdForStore(storeId, productId);

  if (!existing) {
    throw new AiApiRouteError(404, "not_found", "No product with that id in this store.");
  }

  const columnUpdate: Record<string, unknown> = {};
  const contentUpdate: Record<string, string | null> = {};
  const changed: string[] = [];

  for (const field of PRODUCT_COLUMN_FIELDS) {
    if (body[field] !== undefined) {
      columnUpdate[field] = body[field];
      changed.push(field);
    }
  }

  for (const field of PRODUCT_CONTENT_FIELDS) {
    if (body[field] !== undefined) {
      contentUpdate[field] = body[field] ?? null;
      changed.push(field);
    }
  }

  if (Object.keys(columnUpdate).length > 0) {
    // Through `updateProduct`, not the repository: that is where slug and SKU
    // uniqueness and the pre-order plan gate live. The slug is deliberately not
    // re-derived from a new title — it is the URL the product is already
    // indexed at, and quietly moving it is not something a copy edit should do.
    const updated = await updateProduct(storeId, productId, columnUpdate);

    if (!updated) {
      throw new AiApiRouteError(404, "not_found", "No product with that id in this store.");
    }
  }

  if (Object.keys(contentUpdate).length > 0) {
    await saveProductContentFields(storeId, productId, contentUpdate);
  }

  const product = await getProductByIdForStore(storeId, productId);

  if (!product) {
    throw new AiApiRouteError(404, "not_found", "No product with that id in this store.");
  }

  await logAiAction({
    actor,
    message: `AI updated product ${product.title}`,
    metadata: { changed, productId },
    source: "PRODUCT",
    storeId
  });

  return aiProductUpdateResponseSchema.parse({
    changed,
    product: {
      category: product.category
        ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
        : null,
      compareAtPrice: optionalDecimalToString(product.compareAtPrice),
      createdAt: toIsoString(product.createdAt),
      id: product.id,
      images: product.images.map((image) => ({
        alt: image.alt,
        position: image.position,
        url: image.url
      })),
      price: decimalToString(product.price),
      sku: product.sku,
      slug: product.slug,
      status: product.status,
      stockQuantity: product.stockQuantity,
      title: product.title,
      updatedAt: toIsoString(product.updatedAt),
      visibility: product.visibility
    },
    storeId
  });
}

export async function createAiCoupon(params: {
  actor: AiActor;
  body: AiCouponCreateBody;
  storeId: string;
}): Promise<AiCouponCreateResponse> {
  const { actor, body, storeId } = params;

  // `createCoupon` parses with `createCouponSchema`, which carries every
  // cross-field invariant — a percentage over 100, a cap on a fixed discount, an
  // end date before the start. A duplicate code throws `CouponError`, which the
  // route turns into a 409 rather than a 500.
  const coupon = await createCoupon(storeId, {
    code: body.code,
    discountType: body.discountType,
    discountValue: body.discountValue,
    name: body.name,
    status: body.status,
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
    ...(body.maxDiscountAmount !== undefined ? { maxDiscountAmount: body.maxDiscountAmount } : {}),
    ...(body.maxSubtotal !== undefined ? { maxSubtotal: body.maxSubtotal } : {}),
    ...(body.minSubtotal !== undefined ? { minSubtotal: body.minSubtotal } : {}),
    ...(body.startsAt !== undefined ? { startsAt: body.startsAt } : {}),
    ...(body.usageLimitPerCustomer !== undefined
      ? { usageLimitPerCustomer: body.usageLimitPerCustomer }
      : {}),
    ...(body.usageLimitTotal !== undefined ? { usageLimitTotal: body.usageLimitTotal } : {})
  });

  await logAiAction({
    actor,
    message: `AI created coupon ${coupon.code}`,
    metadata: { code: coupon.code, couponId: coupon.id },
    source: "STORE",
    storeId
  });

  return aiCouponCreateResponseSchema.parse({
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: decimalToString(coupon.discountValue),
      expiresAt: coupon.expiresAt ? toIsoString(coupon.expiresAt) : null,
      id: coupon.id,
      name: coupon.name,
      startsAt: coupon.startsAt ? toIsoString(coupon.startsAt) : null,
      status: coupon.status
    },
    storeId
  });
}

export async function setAiOrderStatus(params: {
  actor: AiActor;
  body: AiOrderStatusBody;
  orderId: string;
  storeId: string;
}): Promise<AiOrderStatusResponse> {
  const { actor, body, orderId, storeId } = params;
  const existing = await getOrderByIdForStore(storeId, orderId);

  if (!existing) {
    throw new AiApiRouteError(404, "not_found", "No order with that id in this store.");
  }

  if (existing.status === body.status) {
    // Not an error, and not a write either: reporting the change honestly means
    // not claiming one that did not happen.
    return aiOrderStatusResponseSchema.parse({
      id: existing.id,
      orderNumber: existing.orderNumber,
      previousStatus: existing.status,
      status: existing.status,
      storeId
    });
  }

  // `updateOrderStatus` re-scores the customer's other orders when an order
  // crosses the CANCELLED boundary, which is why this goes through the service
  // rather than the repository.
  await updateOrderStatus(storeId, orderId, body.status);

  await logAiAction({
    actor,
    message: `AI set order ${existing.orderNumber} to ${body.status}`,
    metadata: { from: existing.status, orderId, to: body.status },
    source: "ORDER",
    storeId
  });

  return aiOrderStatusResponseSchema.parse({
    id: existing.id,
    orderNumber: existing.orderNumber,
    previousStatus: existing.status,
    status: body.status,
    storeId
  });
}

/**
 * The audit entry.
 *
 * Never allowed to fail the action it records: the write has already happened
 * by the time this runs, so throwing here would answer 500 for a change that
 * did go through and invite the assistant to retry it. A missing log line is
 * the lesser problem, and it goes to the server log where an operator sees it.
 */
async function logAiAction(params: {
  actor: AiActor;
  message: string;
  metadata: Record<string, unknown>;
  source: "ORDER" | "PRODUCT" | "STORE";
  storeId: string;
}) {
  try {
    await createSystemLog({
      level: "INFO",
      message: params.message,
      metadata: {
        ...params.metadata,
        keyHint: params.actor.keyHint,
        keyId: params.actor.keyId,
        keyName: params.actor.keyName,
        via: params.actor.via ?? "ai-api"
      },
      source: params.source,
      storeId: params.storeId
    });
  } catch (error) {
    console.error("[ai-api] could not write the action log:", error);
  }
}
