import { z } from "zod";

export const saleTypeSchema = z.enum(["ONLINE", "OFFLINE"]);
export const saleStatusSchema = z.enum(["DRAFT", "COMPLETED", "CANCELLED", "RETURNED"]);
export const salePaymentStatusSchema = z.enum(["PAID", "PARTIAL", "UNPAID"]);
export const salePaymentMethodSchema = z.enum(["CASH", "CARD", "BKASH", "NAGAD", "BANK", "COD", "OTHER"]);

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim() || "0")
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Use a valid amount with up to 2 decimal places."
  });

const saleItemSchema = z.object({
  discount: moneySchema.default("0"),
  productId: z.string().trim().min(1, "Select a product."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unitPrice: moneySchema
});

export const saleBaseSchema = z.object({
  customerId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  discount: moneySchema.default("0"),
  items: z.array(saleItemSchema).min(1, "Add at least one product."),
  notes: z.string().trim().max(2000).optional(),
  paidAmount: moneySchema.default("0"),
  paymentMethod: salePaymentMethodSchema.default("CASH"),
  saleDate: z.string().trim().min(1, "Sale date is required."),
  saleType: saleTypeSchema.default("OFFLINE"),
  shipping: moneySchema.default("0"),
  status: saleStatusSchema.default("DRAFT"),
  tax: moneySchema.default("0")
});

export const createSaleSchema = saleBaseSchema;
export const updateSaleSchema = saleBaseSchema;

export type SaleType = z.infer<typeof saleTypeSchema>;
export type SaleStatus = z.infer<typeof saleStatusSchema>;
export type SalePaymentStatus = z.infer<typeof salePaymentStatusSchema>;
export type SalePaymentMethod = z.infer<typeof salePaymentMethodSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type SaleItemInput = CreateSaleInput["items"][number];
