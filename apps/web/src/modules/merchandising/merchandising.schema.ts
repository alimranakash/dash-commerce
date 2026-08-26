import { z } from "zod";

export const productRelationTypeSchema = z.enum(["UPSELL", "CROSS_SELL", "ACCESSORY"]);

export type ProductRelationType = z.infer<typeof productRelationTypeSchema>;

/**
 * The order the storefront spends a seller's pairings in.
 *
 * An upsell is worth more than a cross-sell on the same rail — it is the same
 * purchase at a higher price rather than a second one — so when the rail has
 * fewer slots than the seller has pairings, upsells are what survives.
 */
export const PRODUCT_RELATION_PRIORITY = ["UPSELL", "CROSS_SELL", "ACCESSORY"] as const satisfies readonly ProductRelationType[];

/**
 * How many products a seller may pair into one list.
 *
 * The storefront rails show four to six cards, so anything past a dozen is a
 * pool nobody will ever see the end of, and picking it is the harder job.
 */
export const MAX_RELATIONS_PER_TYPE = 12;

/**
 * How far back the co-purchase counts look.
 *
 * Long, because most stores on this platform do not have the order volume for
 * a shorter window to say anything at all. A pair whose product has since been
 * pulled from the catalogue falls out when the ids are hydrated, not here.
 */
export const CO_PURCHASE_WINDOW_DAYS = 365;

/**
 * How many separate orders must carry a pair before it is offered as one.
 *
 * One shared order is a coincidence; two is the smallest number that is not.
 * Raising it would make the suggestions safer and, for most stores here,
 * empty.
 */
export const MIN_CO_PURCHASE_ORDERS = 2;

const relatedProductIdsSchema = z
  .array(z.string().trim().min(1))
  .max(MAX_RELATIONS_PER_TYPE, `Pick at most ${MAX_RELATIONS_PER_TYPE} products for one list.`)
  .default([]);

export const setProductRelationsSchema = z.object({
  ACCESSORY: relatedProductIdsSchema,
  CROSS_SELL: relatedProductIdsSchema,
  UPSELL: relatedProductIdsSchema
});

export type SetProductRelationsInput = z.input<typeof setProductRelationsSchema>;
