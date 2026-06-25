import { z } from "zod";

export const stockMovementTypeSchema = z.enum([
  "STOCK_IN",
  "STOCK_OUT",
  "ADJUSTMENT",
  "RETURN",
  "DAMAGE",
  "LOST"
]);

export const stockMovementSourceTypeSchema = z.enum([
  "PURCHASE",
  "SALE",
  "MANUAL",
  "RETURN",
  "SYSTEM"
]);

export const stockAdjustmentTypeSchema = z.enum(["INCREASE", "DECREASE", "SET"]);

export const stockAdjustmentSchema = z.object({
  adjustmentType: stockAdjustmentTypeSchema,
  allowNegative: z.boolean().default(false),
  notes: z.string().trim().max(1000, "Notes must be 1000 characters or less.").optional(),
  productId: z.string().min(1, "Choose a product."),
  quantity: z.coerce.number().int("Quantity must be a whole number.").min(0, "Quantity cannot be negative."),
  reason: z.string().trim().min(2, "Reason is required.").max(160, "Reason must be 160 characters or less.")
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type StockAdjustmentType = z.infer<typeof stockAdjustmentTypeSchema>;
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
