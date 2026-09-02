import { z } from "zod";

/**
 * What `/api/wishlist` will act on.
 *
 * A discriminated union rather than one loose object because `clear` is the one
 * action with no product: making `productId` optional across the board would let
 * an `add` with nothing to add reach the service and fail there instead of here.
 */
const productIdSchema = z.string().trim().min(1, "A product is required.").max(64);

export const wishlistRequestSchema = z.discriminatedUnion("wishlistAction", [
  z.object({
    productId: productIdSchema,
    wishlistAction: z.literal("add")
  }),
  z.object({
    productId: productIdSchema,
    wishlistAction: z.literal("remove")
  }),
  z.object({
    productId: productIdSchema,
    wishlistAction: z.literal("toggle")
  }),
  z.object({
    wishlistAction: z.literal("clear")
  })
]);

export type WishlistRequestInput = z.infer<typeof wishlistRequestSchema>;
