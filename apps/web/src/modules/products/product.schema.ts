import { z } from "zod";
import { normalizeSlug } from "../../lib/slug";

export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Use a valid amount with up to 2 decimal places."
  });

const optionalMoneySchema = z
  .union([moneySchema, z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : undefined));

const productImageSchema = z.object({
  url: z.url("Use a valid image URL."),
  alt: z.string().trim().max(160).optional(),
  position: z.coerce.number().int().min(0).default(0)
});

const productBaseSchema = z.object({
  title: z.string().trim().min(2, "Product title is required.").max(160),
  slug: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeSlug(value) : undefined)),
  description: z.string().trim().max(10000).optional(),
  shortDescription: z.string().trim().max(320).optional(),
  sku: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || undefined),
  price: moneySchema,
  compareAtPrice: optionalMoneySchema,
  costPrice: optionalMoneySchema,
  stockQuantity: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  status: productStatusSchema.default("DRAFT"),
  visibility: z.enum(["PUBLIC", "HIDDEN"]).default("HIDDEN"),
  categoryId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  images: z.array(productImageSchema).max(12).default([])
});

export const createProductSchema = productBaseSchema;

export const updateProductSchema = productBaseSchema.partial().extend({
  images: z.array(productImageSchema).max(12).optional()
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
