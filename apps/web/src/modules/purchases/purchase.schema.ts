import { z } from "zod";

export const purchaseStatusSchema = z.enum(["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"]);

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim() || "0")
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Use a valid amount with up to 2 decimal places."
  });

const purchaseItemSchema = z
  .object({
    productId: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined),
    productName: z.string().trim().max(180).optional(),
    sku: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((value) => value || undefined),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
    unitCost: moneySchema
  })
  .refine((item) => item.productId || item.productName, {
    message: "Select a product or enter a product name.",
    path: ["productName"]
  });

export const purchaseBaseSchema = z.object({
  supplierId: z.string().trim().min(1, "Select a supplier."),
  purchaseDate: z.string().trim().min(1, "Purchase date is required."),
  status: purchaseStatusSchema.default("DRAFT"),
  discountAmount: moneySchema.default("0"),
  taxAmount: moneySchema.default("0"),
  paidAmount: moneySchema.default("0"),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(purchaseItemSchema).min(1, "Add at least one purchase item.")
});

export const createPurchaseSchema = purchaseBaseSchema;
export const updatePurchaseSchema = purchaseBaseSchema;

export type PurchaseStatus = z.infer<typeof purchaseStatusSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type PurchaseItemInput = CreatePurchaseInput["items"][number];
