import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

/**
 * A money field the seller may leave blank, normalised the same way
 * order-create.schema does it: an empty input is "I did not type one", which is
 * not the same answer as zero.
 */
const optionalAmount = (label: string) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => (value === null || value === undefined ? "" : String(value).trim()))
    .refine(
      (value) => value === "" || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 99999999),
      `${label} must be a positive amount.`
    )
    .transform((value) => (value === "" ? undefined : Number(value).toFixed(2)));

/**
 * The three settlements a seller can open against a delivered order.
 *
 * RETURN   — goods come back, money goes back.
 * EXCHANGE — goods come back, replacement goods go out, only the difference moves.
 * REFUND   — money goes back with nothing coming back: a goodwill gesture, a
 *            partial discount after a complaint, a delivery that never arrived.
 */
export const orderReturnTypes = ["RETURN", "EXCHANGE", "REFUND"] as const;

/**
 * REQUESTED → APPROVED → (IN_TRANSIT →) RECEIVED → COMPLETED, with REJECTED and
 * CANCELLED as the two ways out. A REFUND has no goods to collect and so skips
 * from APPROVED straight to COMPLETED; the transition table lives in
 * return.service.ts, which is the only thing allowed to move a request.
 */
export const orderReturnStatuses = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "IN_TRANSIT",
  "RECEIVED",
  "COMPLETED",
  "CANCELLED"
] as const;

export const orderReturnReasons = [
  "DAMAGED",
  "DEFECTIVE",
  "WRONG_ITEM",
  "SIZE_ISSUE",
  "NOT_AS_DESCRIBED",
  "CHANGED_MIND",
  "LATE_DELIVERY",
  "OTHER"
] as const;

/** Where the money goes back. Mirrors the manual gateways sellers actually use here. */
export const orderRefundMethods = [
  "ORIGINAL_PAYMENT",
  "BKASH",
  "NAGAD",
  "ROCKET",
  "BANK",
  "CASH",
  "STORE_CREDIT",
  "NONE"
] as const;

export const orderReturnTypeSchema = z.enum(orderReturnTypes);
export const orderReturnStatusSchema = z.enum(orderReturnStatuses);
export const orderReturnReasonSchema = z.enum(orderReturnReasons);
export const orderRefundMethodSchema = z.enum(orderRefundMethods);

/**
 * One line of the request: how much of an ordered item is coming back, and — on
 * an exchange — what goes out in its place.
 *
 * The line names an `orderItemId` rather than a product id on purpose. Price is
 * read off the order line, not off the product, because a product re-priced
 * since the order was placed must not change what the customer gets back.
 */
export const orderReturnLineSchema = z.object({
  orderItemId: z.string().trim().min(1, "Choose an ordered item for every line."),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(9999, "Quantity is too large."),
  replacementProductId: optionalText(200),
  /** Blank means "one replacement for each unit coming back". */
  replacementQuantity: z.coerce
    .number()
    .int("Replacement quantity must be a whole number.")
    .min(0)
    .max(9999, "Replacement quantity is too large.")
    .default(0)
});

export const createOrderReturnSchema = z
  .object({
    /** Only read when there are no lines — a refund that is not tied to goods. */
    flatRefundAmount: optionalAmount("Refund amount"),
    items: z.array(orderReturnLineSchema).max(100, "A request can hold at most 100 lines."),
    orderId: z.string().trim().min(1, "Choose an order."),
    reason: orderReturnReasonSchema,
    reasonNote: optionalText(1000),
    refundMethod: orderRefundMethodSchema.default("ORIGINAL_PAYMENT"),
    restockItems: z.boolean().default(true),
    restockingFee: optionalAmount("Restocking fee"),
    shippingRefundAmount: optionalAmount("Delivery refund"),
    type: orderReturnTypeSchema
  })
  .superRefine((value, ctx) => {
    if (value.items.length === 0) {
      // A return or an exchange is defined by the goods moving, so it cannot be
      // empty. A refund can: "give them 200 back for the trouble" is a real case.
      if (value.type !== "REFUND") {
        ctx.addIssue({
          code: "custom",
          message: "Choose at least one item from the order.",
          path: ["items"]
        });
      } else if (!value.flatRefundAmount || Number(value.flatRefundAmount) <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Enter the amount to refund.",
          path: ["flatRefundAmount"]
        });
      }
    }

    if (
      value.type === "EXCHANGE" &&
      !value.items.some((item) => Boolean(item.replacementProductId))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "An exchange needs a replacement product on at least one line.",
        path: ["items"]
      });
    }
  });

/** What the seller fills in when the money actually leaves. */
export const recordOrderReturnRefundSchema = z.object({
  refundMethod: orderRefundMethodSchema,
  refundReference: optionalText(120),
  resolutionNote: optionalText(1000)
});

export type CreateOrderReturnInput = z.input<typeof createOrderReturnSchema>;
export type OrderRefundMethod = z.infer<typeof orderRefundMethodSchema>;
export type OrderReturnLineInput = z.infer<typeof orderReturnLineSchema>;
export type OrderReturnReason = z.infer<typeof orderReturnReasonSchema>;
export type OrderReturnStatus = z.infer<typeof orderReturnStatusSchema>;
export type OrderReturnType = z.infer<typeof orderReturnTypeSchema>;
export type RecordOrderReturnRefundInput = z.input<typeof recordOrderReturnRefundSchema>;
